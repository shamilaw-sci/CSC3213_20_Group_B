import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

import {
  MutationCoordinationLostError,
  MutationResourceBusyError,
} from '@/operations/mutation-coordinator';
import { OperationExecutor } from '@/operations/operation.executor';
import { PostgresMutationCoordinator } from '@/operations/postgres-mutation-coordinator';
import { PostgresOperationStore } from '@/operations/postgres-operation.store';

const postgresTest = process.env.POSTGRES_TEST_URL ? test : test.skip;
const connectionString = process.env.POSTGRES_TEST_URL;

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function withPools<T>(
  action: (first: Pool, second: Pool, admin: Pool) => Promise<T>
): Promise<T> {
  const schema = `scs_coord_${crypto.randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString });
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const first = new Pool({
    connectionString,
    options: `-c search_path=${schema}`,
    max: 4,
    application_name: `${schema}_first`,
    connectionTimeoutMillis: 500,
  });
  const second = new Pool({
    connectionString,
    options: `-c search_path=${schema}`,
    max: 4,
    application_name: `${schema}_second`,
    connectionTimeoutMillis: 500,
  });
  try {
    return await action(first, second, admin);
  } finally {
    await Promise.all([first.end(), second.end()]);
    await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
  }
}

postgresTest(
  'same resource is exclusive across pools and contention returns busy',
  async () => {
    await withPools(async (firstPool, secondPool) => {
      const first = new PostgresMutationCoordinator(firstPool);
      const second = new PostgresMutationCoordinator(secondPool);
      const entered = deferred();
      const release = deferred();
      const holder = first.runExclusive(
        'project:one',
        'operation-one-0001',
        async () => {
          entered.resolve();
          await release.promise;
          return 'first';
        }
      );
      await entered.promise;
      let ran = false;
      await expect(
        second.runExclusive('project:one', 'operation-two-0002', async () => {
          ran = true;
          return 'second';
        })
      ).rejects.toBeInstanceOf(MutationResourceBusyError);
      expect(ran).toBe(false);
      release.resolve();
      expect(await holder).toBe('first');
      expect(
        await second.runExclusive(
          'project:one',
          'operation-two-0002',
          async () => 'second'
        )
      ).toBe('second');
    });
  }
);

postgresTest(
  'different resources run concurrently and errors release locks',
  async () => {
    await withPools(async (firstPool, secondPool) => {
      const first = new PostgresMutationCoordinator(firstPool);
      const second = new PostgresMutationCoordinator(secondPool);
      const entered = deferred();
      const release = deferred();
      const holder = first.runExclusive(
        'project:one',
        'operation-one-0001',
        async () => {
          entered.resolve();
          await release.promise;
        }
      );
      await entered.promise;
      expect(
        await second.runExclusive(
          'project:two',
          'operation-two-0002',
          async () => 'parallel'
        )
      ).toBe('parallel');
      release.resolve();
      await holder;
      await expect(
        first.runExclusive('project:one', 'operation-one-0001', async () => {
          throw new Error('handler failure');
        })
      ).rejects.toThrow('handler failure');
      expect(
        await second.runExclusive(
          'project:one',
          'operation-two-0002',
          async () => 'recovered'
        )
      ).toBe('recovered');
    });
  }
);

postgresTest(
  'long-running work retains the lock through heartbeats',
  async () => {
    await withPools(async (firstPool, secondPool) => {
      const first = new PostgresMutationCoordinator(firstPool, {
        heartbeatMs: 20,
        heartbeatTimeoutMs: 500,
      });
      const second = new PostgresMutationCoordinator(secondPool);
      const entered = deferred();
      const release = deferred();
      const holder = first.runExclusive(
        'project:long',
        'operation-long-001',
        async () => {
          entered.resolve();
          await release.promise;
        }
      );
      await entered.promise;
      await new Promise((resolve) => setTimeout(resolve, 100));
      await expect(
        second.runExclusive(
          'project:long',
          'operation-other-01',
          async () => {}
        )
      ).rejects.toBeInstanceOf(MutationResourceBusyError);
      release.resolve();
      await holder;
    });
  }
);

postgresTest(
  'backend termination aborts the task and releases the session lock',
  async () => {
    await withPools(async (firstPool, secondPool, admin) => {
      const first = new PostgresMutationCoordinator(firstPool, {
        heartbeatMs: 20,
        heartbeatTimeoutMs: 500,
      });
      const second = new PostgresMutationCoordinator(secondPool);
      const entered = deferred();
      const release = deferred();
      let observedSignal: AbortSignal | undefined;
      const holder = first.runExclusive(
        'project:crash',
        'operation-crash-001',
        async (signal) => {
          observedSignal = signal;
          entered.resolve();
          await release.promise;
        }
      );
      await entered.promise;
      const backend = await admin.query<{ pid: number }>(
        `SELECT pid FROM pg_stat_activity WHERE application_name LIKE 'scs_coord_%_first' AND state = 'idle' ORDER BY backend_start DESC LIMIT 1`
      );
      expect(backend.rows[0]?.pid).toBeNumber();
      await admin.query('SELECT pg_terminate_backend($1)', [
        backend.rows[0]!.pid,
      ]);
      await expect(holder).rejects.toBeInstanceOf(
        MutationCoordinationLostError
      );
      expect(observedSignal?.aborted).toBe(true);
      release.resolve();
      expect(
        await second.runExclusive(
          'project:crash',
          'operation-recover-01',
          async () => 'recovered'
        )
      ).toBe('recovered');
    });
  }
);

postgresTest('process termination releases its advisory lock', async () => {
  await withPools(async (_firstPool, secondPool) => {
    const child = Bun.spawn(
      [
        process.execPath,
        fileURLToPath(
          new URL('./helpers/postgres-lock-holder.ts', import.meta.url)
        ),
      ],
      {
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...process.env, POSTGRES_TEST_URL: connectionString! },
      }
    );
    try {
      const reader = child.stdout.getReader();
      const first = await reader.read();
      expect(new TextDecoder().decode(first.value)).toContain('LOCKED');
      child.kill();
      await child.exited;
      const coordinator = new PostgresMutationCoordinator(secondPool);
      let recovered = false;
      for (let attempt = 0; attempt < 20 && !recovered; attempt += 1) {
        try {
          await coordinator.runExclusive(
            'project:process-crash',
            'operation-after-crash-01',
            async () => {}
          );
          recovered = true;
        } catch (error) {
          if (!(error instanceof MutationResourceBusyError)) throw error;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
      }
      expect(recovered).toBe(true);
    } finally {
      child.kill();
      await child.exited;
    }
  });
});

postgresTest(
  'PostgreSQL failure prevents task execution and a new pool recovers',
  async () => {
    await withPools(async (firstPool, secondPool) => {
      const unavailable = new Pool({ connectionString });
      await unavailable.end();
      let ran = false;
      await expect(
        new PostgresMutationCoordinator(unavailable).runExclusive(
          'project:failed',
          'operation-failed-01',
          async () => {
            ran = true;
          }
        )
      ).rejects.toThrow();
      expect(ran).toBe(false);
      expect(
        await new PostgresMutationCoordinator(secondPool).runExclusive(
          'project:failed',
          'operation-recover-01',
          async () => 'ok'
        )
      ).toBe('ok');
    });
  }
);

postgresTest(
  'executor retains retry and conflict outcomes with PostgreSQL coordination',
  async () => {
    await withPools(async (firstPool, secondPool) => {
      const migration = await readFile(
        new URL(
          '../migrations/postgres/0001_operation_state.sql',
          import.meta.url
        ),
        'utf8'
      );
      await firstPool.query(migration);
      const store = new PostgresOperationStore(firstPool);
      let attempts = 0;
      const executor = new OperationExecutor({
        store,
        coordinator: new PostgresMutationCoordinator(secondPool),
        handlers: {
          retry: async () => {
            attempts += 1;
            if (attempts === 1) throw new Error('retry');
            return { status: 'succeeded' };
          },
          conflict: async () => {
            throw new Error('conflict');
          },
        },
        classifyError: (error) => ({
          category:
            (error as Error).message === 'conflict'
              ? 'compare_conflict'
              : 'transient_server',
          retryable: (error as Error).message === 'retry',
        }),
        sleep: async () => {},
        log: () => {},
      });
      const base = {
        actor: { type: 'service' as const, subjectId: 'service-00000001' },
        resource: { type: 'project' as const, id: 'one' },
        payload: {},
        correlationId: 'correlation-0001',
      };
      const retry = await executor.submit({
        ...base,
        idempotencyKey: 'request-retry-00001',
        action: 'retry',
      });
      expect(await executor.execute(retry.operationId)).toMatchObject({
        status: 'succeeded',
        attempt: 2,
      });
      const conflict = await executor.submit({
        ...base,
        idempotencyKey: 'request-conflict-001',
        action: 'conflict',
      });
      expect(await executor.execute(conflict.operationId)).toMatchObject({
        status: 'conflicted',
        attempt: 1,
        outcome: { status: 'conflicted' },
      });
      expect((await store.get(conflict.operationId))?.status).toBe(
        'conflicted'
      );
    });
  }
);

postgresTest(
  'executor does not save success after coordination is lost',
  async () => {
    await withPools(async (storePool, coordinatorPool, admin) => {
      const migration = await readFile(
        new URL(
          '../migrations/postgres/0001_operation_state.sql',
          import.meta.url
        ),
        'utf8'
      );
      await storePool.query(migration);
      const store = new PostgresOperationStore(storePool);
      const entered = deferred();
      const release = deferred();
      const handlerReturned = deferred();
      const executor = new OperationExecutor({
        store,
        coordinator: new PostgresMutationCoordinator(coordinatorPool, {
          heartbeatMs: 20,
          heartbeatTimeoutMs: 500,
        }),
        handlers: {
          mutate: async () => {
            entered.resolve();
            await release.promise;
            handlerReturned.resolve();
            return { status: 'succeeded' };
          },
        },
        log: () => {},
      });
      const operation = await executor.submit({
        idempotencyKey: 'request-loss-000001',
        actor: { type: 'service', subjectId: 'service-00000001' },
        resource: { type: 'project', id: 'loss' },
        action: 'mutate',
        payload: {},
        correlationId: 'correlation-0001',
      });
      const execution = executor.execute(operation.operationId);
      await entered.promise;
      const backend = await admin.query<{ pid: number }>(
        `SELECT pid FROM pg_stat_activity WHERE application_name LIKE 'scs_coord_%_second' AND state = 'idle' ORDER BY backend_start DESC LIMIT 1`
      );
      await admin.query('SELECT pg_terminate_backend($1)', [
        backend.rows[0]!.pid,
      ]);
      await expect(execution).rejects.toBeInstanceOf(
        MutationCoordinationLostError
      );
      release.resolve();
      await handlerReturned.promise;
      await new Promise((resolve) => setImmediate(resolve));
      expect(await store.get(operation.operationId)).toMatchObject({
        status: 'running',
        attempt: 1,
      });
    });
  }
);
