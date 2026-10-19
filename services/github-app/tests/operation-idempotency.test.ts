import { describe, expect, test } from 'bun:test';

import {
  InMemoryOperationStore,
  localOperationStore,
} from '@/operations/in-memory-operation.store';
import { InMemoryMutationCoordinator } from '@/operations/mutation-coordinator';
import { OperationExecutor } from '@/operations/operation.executor';
import { createOperationExecutor } from '@/operations/queue.consumer';
import type { GithubAppEnv } from '@/types/env';

const command = {
  idempotencyKey: 'request-key-00000001',
  actor: { type: 'user' as const, subjectId: 'person-0000000001' },
  resource: { type: 'project' as const, id: 'example' },
  action: 'project.upsert',
  payload: { title: 'Example', tags: ['one', 'two'] },
  correlationId: 'correlation-0001',
};

describe('operation idempotency', () => {
  test('reuses an operation for the same actor, key, action, resource, and payload', async () => {
    let calls = 0;
    const executor = new OperationExecutor({
      store: new InMemoryOperationStore(),
      coordinator: new InMemoryMutationCoordinator(),
      handlers: {
        'project.upsert': async () => {
          calls += 1;
          return { status: 'succeeded' };
        },
      },
      log: () => {},
    });

    const first = await executor.submit(command);
    const duplicate = await executor.submit({
      ...command,
      payload: { tags: ['one', 'two'], title: 'Example' },
    });
    await executor.execute(first.operationId);
    await executor.execute(duplicate.operationId);

    expect(duplicate.operationId).toBe(first.operationId);
    expect(calls).toBe(1);
  });

  test('rejects reuse of an actor idempotency key for a different mutation', async () => {
    const executor = new OperationExecutor({
      store: new InMemoryOperationStore(),
      coordinator: new InMemoryMutationCoordinator(),
      handlers: {},
      log: () => {},
    });
    await executor.submit(command);

    expect(
      executor.submit({ ...command, payload: { title: 'Different' } })
    ).rejects.toThrow('idempotency key');
  });

  test('executes submitted operations in process when bindings are absent', async () => {
    const executor = createOperationExecutor({} as GithubAppEnv, {
      'local.execute': async () => ({ status: 'succeeded' }),
    });
    const queued = await executor.submit({
      ...command,
      idempotencyKey: 'local-request-0000001',
      action: 'local.execute',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((await localOperationStore.get(queued.operationId))?.status).toBe(
      'succeeded'
    );
  });
});
