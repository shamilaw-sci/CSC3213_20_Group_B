import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { PgBoss } from 'pg-boss';
import { Pool } from 'pg';

import { OperationExecutor } from '@/operations/operation.executor';
import { PostgresMutationCoordinator } from '@/operations/postgres-mutation-coordinator';
import {
  OPERATION_DEAD_LETTER_NAME,
  OPERATION_QUEUE_NAME,
  PostgresOperationDispatcher,
  PostgresOperationWorker,
  preparePostgresOperationQueues,
} from '@/operations/postgres-operation-queue';
import { PostgresOperationStore } from '@/operations/postgres-operation.store';

const postgresTest = process.env.POSTGRES_TEST_URL ? test : test.skip;

async function eventually(check: () => Promise<boolean>, timeoutMs = 10_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (await check()) return;
    await Bun.sleep(100);
  }
  throw new Error('Timed out waiting for PostgreSQL queue state');
}

const command = (key: string, resource = key) => ({
  idempotencyKey: key,
  actor: { type: 'user' as const, subjectId: 'person-0000000001' },
  resource: { type: 'project' as const, id: resource },
  action: 'project.upsert',
  payload: { title: key },
  correlationId: 'correlation-0001',
});

postgresTest(
  'PostgreSQL outbox and pg-boss survive failures and coordinate independent workers',
  async () => {
    const connectionString = process.env.POSTGRES_TEST_URL!;
    const schema = `scs_phase5_${crypto.randomUUID().replaceAll('-', '')}`;
    const bossSchema = `${schema}_boss`;
    const admin = new Pool({ connectionString });
    const firstPool = new Pool({
      connectionString,
      options: `-c search_path=${schema}`,
      max: 6,
    });
    const secondPool = new Pool({
      connectionString,
      options: `-c search_path=${schema}`,
      max: 6,
    });
    const bossA = new PgBoss({
      connectionString,
      schema: bossSchema,
      reindex: false,
    });
    const bossB = new PgBoss({
      connectionString,
      schema: bossSchema,
      reindex: false,
    });
    const storeA = new PostgresOperationStore(firstPool, {
      dispatchOutbox: true,
    });
    const storeB = new PostgresOperationStore(secondPool, {
      dispatchOutbox: true,
    });
    const dispatchA = new PostgresOperationDispatcher(firstPool, bossA);
    const dispatchB = new PostgresOperationDispatcher(secondPool, bossB);
    let calls = 0;
    let failOnce = true;
    const handler = async () => {
      calls++;
      if (failOnce) {
        failOnce = false;
        throw new Error('transient handler failure');
      }
      return { status: 'succeeded' as const };
    };
    const classifyError = () => ({ category: 'transient', retryable: true });
    const executorA = new OperationExecutor({
      store: storeA,
      coordinator: new PostgresMutationCoordinator(firstPool),
      handlers: { 'project.upsert': handler },
      dispatch: dispatchA,
      classifyError,
      sleep: async () => {},
      log: () => {},
    });
    const executorB = new OperationExecutor({
      store: storeB,
      coordinator: new PostgresMutationCoordinator(secondPool),
      handlers: { 'project.upsert': handler },
      dispatch: dispatchB,
      classifyError,
      sleep: async () => {},
      log: () => {},
    });
    const workerA = new PostgresOperationWorker(bossA, dispatchA, executorA);
    const workerB = new PostgresOperationWorker(bossB, dispatchB, executorB);
    try {
      await admin.query(`CREATE SCHEMA "${schema}"`);
      const migration = async (filename: string) => {
        const sql = await readFile(
          new URL(`../migrations/postgres/${filename}`, import.meta.url),
          'utf8'
        );
        await firstPool.query(sql);
      };
      await migration('0001_operation_state.sql');
      // A missing outbox must roll back the operation insert atomically.
      await expect(
        storeA.create({
          version: 1,
          operationId: 'operation-before-outbox',
          idempotencyHash: 'a'.repeat(64),
          idempotencyKey: 'before-outbox-0001',
          actor: command('before-outbox-0001').actor,
          resource: command('before-outbox-0001').resource,
          action: 'project.upsert',
          payload: {},
          correlationId: 'correlation-0001',
          status: 'queued',
          attempt: 0,
          maxAttempts: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      ).rejects.toThrow('operation_dispatch_outbox');
      expect(await storeB.get('operation-before-outbox')).toBeNull();
      await migration('0002_operation_dispatch_outbox.sql');
      await bossA.start();
      await bossB.start();
      await preparePostgresOperationQueues(bossA);

      // A failed publish still leaves a durable operation and dispatch intent.
      const unavailable = new PostgresOperationDispatcher(firstPool, {
        send: async () => {
          throw new Error('queue unavailable');
        },
      } as unknown as PgBoss);
      const submitting = new OperationExecutor({
        store: storeA,
        coordinator: new PostgresMutationCoordinator(firstPool),
        handlers: {},
        dispatch: unavailable,
        log: () => {},
      });
      await expect(
        submitting.submit(command('dispatch-failure-0001'))
      ).rejects.toThrow('queue unavailable');
      const stranded = await firstPool.query<{ operation_id: string }>(
        'SELECT operation_id FROM operation_dispatch_outbox WHERE dispatched_at IS NULL'
      );
      expect(stranded.rows).toHaveLength(1);
      expect(await dispatchB.recoverPending()).toBe(1);
      expect(await dispatchA.recoverPending()).toBe(0);

      // A repeated submission cannot create another operation or outbox row.
      const original = await executorA.submit(command('queue-duplicate-0001'));
      expect(
        (await executorB.submit(command('queue-duplicate-0001'))).operationId
      ).toBe(original.operationId);
      const rows = await firstPool.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM operation_dispatch_outbox WHERE operation_id = $1',
        [original.operationId]
      );
      expect(rows.rows[0]?.count).toBe('1');
      const [sameA, sameB] = await Promise.all([
        executorA.submit(command('queue-concurrent-0001')),
        executorB.submit(command('queue-concurrent-0001')),
      ]);
      expect(sameA.operationId).toBe(sameB.operationId);
      expect(
        await bossA.findJobs(OPERATION_QUEUE_NAME, {
          data: { operationId: sameA.operationId },
        })
      ).toHaveLength(1);
      await firstPool.query(
        'UPDATE operation_dispatch_outbox SET dispatched_at = NULL WHERE operation_id = $1',
        [original.operationId]
      );
      await dispatchB.dispatch(original.operationId);

      await workerA.start();
      await workerB.start();
      await eventually(
        async () =>
          (await storeB.get(original.operationId))?.status === 'succeeded'
      );
      expect(calls).toBeGreaterThanOrEqual(2);
      await eventually(async () =>
        (await bossA.findJobs(OPERATION_QUEUE_NAME)).every(
          (job) => job.state === 'completed'
        )
      );

      // Cancellation before execution remains terminal after delivery.
      await workerA.stop();
      await workerB.stop();
      const cancelled = await executorA.submit(command('queue-cancel-0001'));
      await executorB.cancel(cancelled.operationId);
      await workerB.start();
      await eventually(
        async () =>
          (await storeA.get(cancelled.operationId))?.status === 'cancelled'
      );

      // A held resource lock makes delivery retry without spending an operation attempt.
      await workerB.stop();
      let releaseLock = () => {};
      let lockHeld = () => {};
      const held = new Promise<void>((resolve) => {
        releaseLock = resolve;
      });
      const acquired = new Promise<void>((resolve) => {
        lockHeld = resolve;
      });
      const coordinator = new PostgresMutationCoordinator(firstPool);
      const holding = coordinator.runExclusive(
        'project:contended',
        'other-operation',
        async () => {
          lockHeld();
          await held;
        }
      );
      await acquired;
      const contended = await executorA.submit(
        command('queue-contention-0001', 'contended')
      );
      await workerB.start();
      await eventually(async () =>
        (
          await bossA.findJobs(OPERATION_QUEUE_NAME, {
            data: { operationId: contended.operationId },
          })
        ).some((job) => job.retryCount > 0)
      );
      expect((await storeB.get(contended.operationId))?.attempt).toBe(0);
      releaseLock();
      await holding;
      await eventually(
        async () =>
          (await storeB.get(contended.operationId))?.status === 'succeeded'
      );

      // A new worker instance can consume a job enqueued before it started.
      await workerB.stop();
      await bossB.stop();
      const restarted = await executorA.submit(command('queue-restart-0001'));
      const replacementBoss = new PgBoss({
        connectionString,
        schema: bossSchema,
        reindex: false,
      });
      const replacementPool = new Pool({
        connectionString,
        options: `-c search_path=${schema}`,
        max: 6,
      });
      const replacementStore = new PostgresOperationStore(replacementPool, {
        dispatchOutbox: true,
      });
      const replacementDispatch = new PostgresOperationDispatcher(
        replacementPool,
        replacementBoss
      );
      const replacementExecutor = new OperationExecutor({
        store: replacementStore,
        coordinator: new PostgresMutationCoordinator(replacementPool),
        handlers: { 'project.upsert': handler },
        dispatch: replacementDispatch,
        log: () => {},
      });
      const replacement = new PostgresOperationWorker(
        replacementBoss,
        replacementDispatch,
        replacementExecutor
      );
      try {
        await replacementBoss.start();
        await replacement.start();
        await eventually(
          async () =>
            (await replacementStore.get(restarted.operationId))?.status ===
            'succeeded'
        );
      } finally {
        await replacement.stop().catch(() => {});
        await replacementBoss.stop();
        await replacementPool.end();
      }

      // An unacknowledged claim from a vanished process is recovered after expiry.
      await bossA.updateQueue(OPERATION_QUEUE_NAME, { expireInSeconds: 1 });
      const orphaned = await executorA.submit(command('queue-orphan-0001'));
      expect(
        (await bossA.fetch<{ operationId: string }>(OPERATION_QUEUE_NAME)).some(
          (job) => job.data.operationId === orphaned.operationId
        )
      ).toBe(true);
      await bossA.stop();
      const recoveringBoss = new PgBoss({
        connectionString,
        schema: bossSchema,
        reindex: false,
        monitorIntervalSeconds: 1,
      });
      const recoveringDispatch = new PostgresOperationDispatcher(
        firstPool,
        recoveringBoss
      );
      const recoveringWorker = new PostgresOperationWorker(
        recoveringBoss,
        recoveringDispatch,
        executorA
      );
      try {
        await recoveringBoss.start();
        await recoveringWorker.start();
        await eventually(async () => {
          await recoveringBoss.supervise();
          return (
            (await storeA.get(orphaned.operationId))?.status === 'succeeded'
          );
        });
      } finally {
        await recoveringWorker.stop().catch(() => {});
        await recoveringBoss.stop();
      }
      await bossA.start();

      // An invalid job exhausts a dedicated short-retry queue and reaches the DLQ.
      await workerA.start();
      await bossA.updateQueue(OPERATION_QUEUE_NAME, { retryLimit: 0 });
      await bossA.send(OPERATION_QUEUE_NAME, { invalid: true });
      await eventually(
        async () =>
          (await bossA.findJobs(OPERATION_DEAD_LETTER_NAME)).length === 1
      );
      expect(await bossA.findJobs(OPERATION_DEAD_LETTER_NAME)).toHaveLength(1);
      await workerA.stop();
      expect(
        await bossA.redrive(OPERATION_DEAD_LETTER_NAME, { limit: 1 })
      ).toBe(1);
      await eventually(
        async () =>
          (await bossA.findJobs(OPERATION_DEAD_LETTER_NAME)).length === 0
      );

      // A broken PostgreSQL connection fails visibly and leaves the real outbox untouched.
      const brokenPool = new Pool({
        connectionString: 'postgres://invalid:invalid@127.0.0.1:1/invalid',
        connectionTimeoutMillis: 250,
      });
      try {
        await expect(
          new PostgresOperationDispatcher(brokenPool, bossA).recoverPending()
        ).rejects.toThrow();
      } finally {
        await brokenPool.end();
      }
    } finally {
      await workerA.stop().catch(() => {});
      await workerB.stop().catch(() => {});
      await bossA.stop().catch(() => {});
      await bossB.stop().catch(() => {});
      await firstPool.end();
      await secondPool.end();
      await admin.query(`DROP SCHEMA IF EXISTS "${bossSchema}" CASCADE`);
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
  },
  30_000
);
