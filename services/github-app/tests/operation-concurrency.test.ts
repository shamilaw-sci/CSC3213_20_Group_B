import { describe, expect, test } from 'bun:test';

import { InMemoryOperationStore } from '@/operations/in-memory-operation.store';
import { InMemoryMutationCoordinator } from '@/operations/mutation-coordinator';
import { OperationExecutor } from '@/operations/operation.executor';

describe('operation resource concurrency', () => {
  test('serializes the same resource while distinct resources progress independently', async () => {
    const active = new Set<string>();
    let sameResourceOverlap = false;
    let maximumParallel = 0;
    const executor = new OperationExecutor({
      store: new InMemoryOperationStore(),
      coordinator: new InMemoryMutationCoordinator(),
      handlers: {
        mutate: async ({ resource }) => {
          if (active.has(resource.id)) sameResourceOverlap = true;
          active.add(resource.id);
          maximumParallel = Math.max(maximumParallel, active.size);
          await new Promise((resolve) => setTimeout(resolve, 5));
          active.delete(resource.id);
          return { status: 'succeeded' };
        },
      },
      log: () => {},
    });
    const base = {
      actor: { type: 'service' as const, subjectId: 'service-00000001' },
      resource: { type: 'project' as const, id: 'one' },
      action: 'mutate',
      payload: {},
      correlationId: 'correlation-0001',
    };
    const operations = await Promise.all([
      executor.submit({ ...base, idempotencyKey: 'request-key-00000001' }),
      executor.submit({ ...base, idempotencyKey: 'request-key-00000002' }),
      executor.submit({
        ...base,
        idempotencyKey: 'request-key-00000003',
        resource: { type: 'project', id: 'two' },
      }),
    ]);

    await Promise.all(
      operations.map((operation) => executor.execute(operation.operationId))
    );

    expect(sameResourceOverlap).toBeFalse();
    expect(maximumParallel).toBe(2);
  });
});
