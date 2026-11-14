import { createHash } from 'node:crypto';

import type { PgBoss } from 'pg-boss';
import type { Pool } from 'pg';

import type { OperationDispatcher } from '@/operations/operation.dispatch';
import type { OperationExecutor } from '@/operations/operation.executor';
import type { OperationQueueMessage } from '@/operations/operation.types';

export const OPERATION_QUEUE_NAME = 'github-operations';
export const OPERATION_DEAD_LETTER_NAME = 'github-operations-dead-letter';

interface OutboxRow {
  operation_id: string;
}

/** A stable pg-boss UUID makes an uncertain publish safe to repeat. */
function jobId(operationId: string): string {
  const hex = createHash('sha256').update(operationId).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Bun/Node only. Start pg-boss and apply both reviewed operation migrations first. */
export async function preparePostgresOperationQueues(
  boss: PgBoss
): Promise<void> {
  await boss.createQueue(OPERATION_DEAD_LETTER_NAME);
  await boss.createQueue(OPERATION_QUEUE_NAME, {
    retryLimit: 20,
    retryDelay: 1,
    retryBackoff: true,
    retryDelayMax: 30,
    deadLetter: OPERATION_DEAD_LETTER_NAME,
    expireInSeconds: 900,
    heartbeatSeconds: 30,
  });
}

/** Atomic outbox claim; a failed publish leaves the row pending for recovery. */
export class PostgresOperationDispatcher implements OperationDispatcher {
  constructor(
    private readonly pool: Pool,
    private readonly boss: PgBoss
  ) {}

  async dispatch(operationId: string): Promise<void> {
    await this.publishOne(operationId);
  }

  async recoverPending(limit = 100): Promise<number> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
      throw new Error('Recovery limit must be between 1 and 1000');
    const rows = await this.pool.query<OutboxRow>(
      `SELECT operation_id FROM operation_dispatch_outbox
       WHERE dispatched_at IS NULL ORDER BY created_at, operation_id LIMIT $1`,
      [limit]
    );
    let delivered = 0;
    for (const row of rows.rows) {
      if (await this.publishOne(row.operation_id)) delivered++;
    }
    return delivered;
  }

  private async publishOne(operationId: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const pending = await client.query<OutboxRow>(
        `SELECT operation_id FROM operation_dispatch_outbox
         WHERE operation_id = $1 AND dispatched_at IS NULL FOR UPDATE`,
        [operationId]
      );
      if (!pending.rows[0]) {
        await client.query('COMMIT');
        return false;
      }
      const sent = await this.boss.send(
        OPERATION_QUEUE_NAME,
        { operationId } satisfies OperationQueueMessage,
        { id: jobId(operationId) }
      );
      if (!sent) {
        const [existing] = await this.boss.findJobs<OperationQueueMessage>(
          OPERATION_QUEUE_NAME,
          { id: jobId(operationId), limit: 1 }
        );
        if (existing?.data.operationId !== operationId)
          throw new Error(`Could not enqueue operation ${operationId}`);
      }
      await client.query(
        'UPDATE operation_dispatch_outbox SET dispatched_at = now() WHERE operation_id = $1',
        [operationId]
      );
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

/** The worker uses pg-boss claims/retries and the existing executor. */
export class PostgresOperationWorker {
  private recoveryTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly boss: PgBoss,
    private readonly dispatcher: PostgresOperationDispatcher,
    private readonly executor: OperationExecutor,
    private readonly onError: (error: unknown) => void = console.error
  ) {}

  async start(): Promise<void> {
    await this.dispatcher.recoverPending();
    await this.boss.work<OperationQueueMessage>(
      OPERATION_QUEUE_NAME,
      { pollingIntervalSeconds: 0.5 },
      async ([job]) => {
        if (!job || typeof job.data?.operationId !== 'string')
          throw new Error('Invalid operation job');
        // Busy resources and transient infrastructure errors stay in pg-boss retry state.
        await this.executor.execute(job.data.operationId);
      }
    );
    this.recoveryTimer = setInterval(() => {
      void this.dispatcher.recoverPending().catch(this.onError);
    }, 5_000);
  }

  async stop(): Promise<void> {
    if (this.recoveryTimer) clearInterval(this.recoveryTimer);
    this.recoveryTimer = undefined;
    await this.boss.offWork(OPERATION_QUEUE_NAME);
  }
}
