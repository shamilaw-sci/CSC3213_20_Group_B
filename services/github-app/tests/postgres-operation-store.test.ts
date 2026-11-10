import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';

import { InMemoryMutationCoordinator } from '@/operations/mutation-coordinator';
import { OperationExecutor } from '@/operations/operation.executor';
import { PostgresOperationStore } from '@/operations/postgres-operation.store';
import {
  OperationRecordSchema,
  type OperationRecord,
} from '@/operations/operation.types';

const postgresTest = process.env.POSTGRES_TEST_URL ? test : test.skip;
const timestamp = '2026-01-01T00:00:00.000Z';

function record(operationId: string): OperationRecord {
  return OperationRecordSchema.parse({
    version: 1,
    operationId,
    idempotencyHash: 'a'.repeat(64),
    idempotencyKey: 'request-key-00000001',
    actor: { type: 'user', subjectId: 'person-0000000001' },
    resource: { type: 'project', id: 'example' },
    action: 'project.upsert',
    payload: { title: 'Original' },
    correlationId: 'correlation-0001',
    status: 'queued',
    attempt: 0,
    maxAttempts: 3,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

postgresTest(
  'PostgreSQL operation store preserves identity, state, cancellation, and recovery across pools',
  async () => {
    const connectionString = process.env.POSTGRES_TEST_URL!;
    const schema = `scs_operation_${crypto.randomUUID().replaceAll('-', '')}`;
    const admin = new Pool({ connectionString });
    await admin.query(`CREATE SCHEMA "${schema}"`);
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
    const first = new PostgresOperationStore(firstPool);
    const second = new PostgresOperationStore(secondPool);
    const migration = await readFile(
      new URL(
        '../migrations/postgres/0001_operation_state.sql',
        import.meta.url
      ),
      'utf8'
    );
    try {
      await firstPool.query(migration);
      expect(await first.get('operation-missing-0001')).toBeNull();
      expect(
        await first.requestCancellation('operation-missing-0001', 'invalid')
      ).toBeNull();
      await expect(
        first.create({
          ...record('operation-new-invalid-01'),
          status: 'invalid',
        } as unknown as OperationRecord)
      ).rejects.toThrow();

      const initial = record('operation-create-0001');
      expect(await first.create(initial)).toEqual({
        created: true,
        operation: initial,
      });
      expect(await second.get(initial.operationId)).toEqual(initial);
      const duplicate = { ...initial, payload: { title: 'Different' } };
      expect(await second.create(duplicate)).toEqual({
        created: false,
        operation: initial,
      });
      expect(
        await first.create({
          ...duplicate,
          status: 'invalid',
        } as unknown as OperationRecord)
      ).toEqual({ created: false, operation: initial });

      const competing = Array.from({ length: 20 }, (_, index) => ({
        ...record('operation-race-00001'),
        payload: { winner: index },
      }));
      const creation = await Promise.all(
        competing.map((candidate, index) =>
          (index % 2 ? first : second).create(candidate)
        )
      );
      expect(creation.filter((result) => result.created)).toHaveLength(1);
      expect(
        creation.every(
          (result) =>
            JSON.stringify(result.operation) ===
            JSON.stringify(creation[0]?.operation)
        )
      ).toBe(true);
      expect(
        await new PostgresOperationStore(secondPool).get('operation-race-00001')
      ).toEqual(creation[0]?.operation);

      const running = {
        ...record('operation-running-001'),
        status: 'running' as const,
        startedAt: timestamp,
      };
      await first.create(running);
      const staleSave = {
        ...running,
        attempt: 1,
        updatedAt: '2026-01-01T00:01:00.000Z',
      };
      const [cancelled] = await Promise.all([
        first.requestCancellation(
          running.operationId,
          '2026-01-01T00:02:00.000Z'
        ),
        second.save(staleSave),
      ]);
      expect(cancelled?.cancellationRequested).toBe(true);
      expect(
        (await first.get(running.operationId))?.cancellationRequested
      ).toBe(true);
      await second.save({ ...staleSave, attempt: 2 });
      expect(await first.get(running.operationId)).toMatchObject({
        attempt: 2,
        cancellationRequested: true,
      });
      expect(
        (await new PostgresOperationStore(firstPool).get(running.operationId))
          ?.attempt
      ).toBe(2);

      const queued = record('operation-queued-0001');
      await first.create(queued);
      const queuedCancelled = await second.requestCancellation(
        queued.operationId,
        '2026-01-01T00:03:00.000Z'
      );
      expect(queuedCancelled).toMatchObject({
        status: 'cancelled',
        cancellationRequested: true,
        completedAt: '2026-01-01T00:03:00.000Z',
        outcome: { status: 'cancelled' },
      });
      expect(
        await first.requestCancellation(queued.operationId, timestamp)
      ).toEqual(queuedCancelled);
      expect(
        await new PostgresOperationStore(secondPool).get(queued.operationId)
      ).toEqual(queuedCancelled);

      const command = {
        idempotencyKey: 'operation-idem-key-001',
        actor: { type: 'user' as const, subjectId: 'person-0000000001' },
        resource: { type: 'project' as const, id: 'example' },
        action: 'project.upsert',
        payload: { title: 'Original' },
        correlationId: 'correlation-0001',
      };
      const executor = new OperationExecutor({
        store: first,
        coordinator: new InMemoryMutationCoordinator(),
        handlers: {},
        log: () => {},
      });
      const submitted = await executor.submit(command);
      expect(await executor.submit(command)).toEqual(submitted);
      await expect(
        executor.submit({ ...command, payload: { title: 'Different' } })
      ).rejects.toThrow('idempotency key');

      const invalidId = 'operation-invalid-0001';
      await firstPool.query(
        'INSERT INTO operation_state (operation_id, operation_json) VALUES ($1, $2::jsonb)',
        [
          invalidId,
          JSON.stringify({ operationId: invalidId, status: 'garbage' }),
        ]
      );
      await expect(first.get(invalidId)).rejects.toThrow();
      await expect(second.save(record(invalidId))).rejects.toThrow();
      await expect(
        first.requestCancellation(invalidId, timestamp)
      ).rejects.toThrow();
      await firstPool.query(
        'UPDATE operation_state SET operation_json = $2::jsonb WHERE operation_id = $1',
        [invalidId, JSON.stringify(record(invalidId))]
      );
      expect(await second.get(invalidId)).toEqual(record(invalidId));

      await firstPool.query('DROP TABLE operation_state');
      await expect(first.get(initial.operationId)).rejects.toMatchObject({
        code: '42P01',
      });
      await secondPool.query(migration);
      expect(await first.create(record('operation-recovery-01'))).toMatchObject(
        { created: true }
      );
    } finally {
      await Promise.all([firstPool.end(), secondPool.end()]);
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.end();
    }
  }
);
