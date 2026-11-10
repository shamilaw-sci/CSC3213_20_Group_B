import { createHash } from 'node:crypto';

import type { Pool, PoolClient, QueryConfig } from 'pg';

import {
  MutationCoordinationLostError,
  MutationResourceBusyError,
  type MutationCoordinator,
} from '@/operations/mutation-coordinator';

interface CoordinatorOptions {
  heartbeatMs?: number;
  heartbeatTimeoutMs?: number;
}

function positiveMilliseconds(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${name} must be a positive integer`);
  return value;
}

/** Deterministic 64-bit lock key. A hash collision only causes false contention. */
function advisoryKey(resourceKey: string): string {
  return createHash('sha256')
    .update(resourceKey)
    .digest()
    .readBigInt64BE(0)
    .toString();
}

/** Bun/Node adapter; retain one checked-out session for the entire mutation. */
export class PostgresMutationCoordinator implements MutationCoordinator {
  private readonly heartbeatMs: number;
  private readonly heartbeatTimeoutMs: number;

  constructor(
    private readonly pool: Pool,
    options: CoordinatorOptions = {}
  ) {
    this.heartbeatMs = positiveMilliseconds(
      options.heartbeatMs ?? 5_000,
      'heartbeatMs'
    );
    this.heartbeatTimeoutMs = positiveMilliseconds(
      options.heartbeatTimeoutMs ?? 5_000,
      'heartbeatTimeoutMs'
    );
  }

  async runExclusive<T>(
    resourceKey: string,
    _operationId: string,
    task: (signal?: AbortSignal) => Promise<T>
  ): Promise<T> {
    const client: PoolClient = await this.pool.connect();
    const key = advisoryKey(resourceKey);
    const controller = new AbortController();
    let rejectLoss: (reason: MutationCoordinationLostError) => void = () => {};
    const loss = new Promise<never>((_resolve, reject) => {
      rejectLoss = reject;
    });
    // Acquisition can fail before the race starts; keep its rejection observed.
    void loss.catch(() => {});
    let lost: MutationCoordinationLostError | null = null;
    let acquired = false;
    let acquisitionFailed = false;
    let unlocked = false;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const markLost = (cause: unknown) => {
      if (lost) return;
      lost = new MutationCoordinationLostError(resourceKey, { cause });
      controller.abort(lost);
      rejectLoss(lost);
    };
    const onError = (error: Error) => markLost(error);
    const onEnd = () => markLost(new Error('PostgreSQL session ended'));
    client.on('error', onError);
    client.on('end', onEnd);

    const scheduleHeartbeat = () => {
      timer = setTimeout(() => {
        if (stopped || lost) return;
        void Promise.resolve()
          .then(() =>
            client.query({
              text: 'SELECT 1',
              query_timeout: this.heartbeatTimeoutMs,
            } as QueryConfig)
          )
          .then(() => {}, markLost)
          .finally(() => {
            if (!stopped && !lost) scheduleHeartbeat();
          });
      }, this.heartbeatMs);
    };

    let outcome!: { ok: true; value: T } | { ok: false; error: unknown };
    try {
      let result;
      try {
        result = await client.query<{ locked: boolean }>(
          'SELECT pg_try_advisory_lock($1::bigint) AS locked',
          [key]
        );
      } catch (error) {
        acquisitionFailed = true;
        throw error as Error;
      }
      if (lost) throw lost as MutationCoordinationLostError;
      if (!result.rows[0]?.locked)
        throw new MutationResourceBusyError(resourceKey);
      acquired = true;
      scheduleHeartbeat();
      const value = await Promise.race([
        Promise.resolve().then(() => task(controller.signal)),
        loss,
      ]);
      if (lost) throw lost as MutationCoordinationLostError;
      outcome = { ok: true, value };
    } catch (error) {
      outcome = { ok: false, error };
    }

    stopped = true;
    if (timer) clearTimeout(timer);
    try {
      if (lost) {
        outcome = { ok: false, error: lost };
      } else if (acquired) {
        const result = await client.query<{ unlocked: boolean }>(
          'SELECT pg_advisory_unlock($1::bigint) AS unlocked',
          [key]
        );
        unlocked = result.rows[0]?.unlocked === true;
        if (lost) outcome = { ok: false, error: lost };
        if (!unlocked) {
          markLost(
            new Error('PostgreSQL advisory lock was not held at release')
          );
          outcome = { ok: false, error: lost };
        }
      }
    } catch (error) {
      markLost(error);
      outcome = { ok: false, error: lost };
    } finally {
      client.removeListener('error', onError);
      client.removeListener('end', onEnd);
      client.release(
        acquisitionFailed || Boolean(lost) || (acquired && !unlocked)
      );
    }
    if (!outcome.ok) throw outcome.error as Error;
    return outcome.value;
  }
}
