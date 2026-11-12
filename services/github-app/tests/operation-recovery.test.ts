import { describe, expect, test } from 'bun:test';

import { InMemoryOperationStore } from '@/operations/in-memory-operation.store';
import { InMemoryMutationCoordinator } from '@/operations/mutation-coordinator';
import { OperationExecutor } from '@/operations/operation.executor';

describe('operation recovery', () => {
  test('acknowledges a persisted command before any GitHub handler runs', async () => {
    const store = new InMemoryOperationStore();
    let githubCalls = 0;
    const executor = new OperationExecutor({
      store,
      coordinator: new InMemoryMutationCoordinator(),
      handlers: {
        mutate: async () => {
          githubCalls += 1;
          return {
            status: 'succeeded',
            pullRequest: {
              number: 12,
              url: 'https://github.com/example/repo/pull/12',
            },
          };
        },
      },
      log: () => {},
    });
    const accepted = await executor.submit({
      idempotencyKey: 'request-key-00000002',
      actor: { type: 'service', subjectId: 'service-00000001' },
      resource: { type: 'project', id: 'example' },
      action: 'mutate',
      payload: {},
      correlationId: 'correlation-0002',
    });

    expect(accepted.status).toBe('queued');
    expect(await store.get(accepted.operationId)).toMatchObject({
      status: 'queued',
    });
    expect(githubCalls).toBe(0);

    const completed = await executor.execute(accepted.operationId);
    expect(githubCalls).toBe(1);
    expect(completed.status).toBe('succeeded');
    expect(completed.outcome).toMatchObject({ pullRequest: { number: 12 } });
  });

  test('persists bounded retry attempts and provider-aware delays', async () => {
    const delays: number[] = [];
    let calls = 0;
    const executor = new OperationExecutor({
      store: new InMemoryOperationStore(),
      coordinator: new InMemoryMutationCoordinator(),
      handlers: {
        mutate: async () => {
          calls += 1;
          if (calls < 3) throw { status: 429, retryAfterMs: 7 };
          return { status: 'succeeded', revision: 'revision-3' };
        },
      },
      classifyError: (error) => ({
        category: 'secondary_rate_limit',
        retryable: true,
        retryAfterMs: (error as { retryAfterMs: number }).retryAfterMs,
      }),
      sleep: async (delayMs) => {
        delays.push(delayMs);
      },
      maxAttempts: 3,
      log: () => {},
    });
    const queued = await executor.submit({
      idempotencyKey: 'request-key-00000001',
      actor: { type: 'service', subjectId: 'service-00000001' },
      resource: { type: 'config', id: 'access' },
      action: 'mutate',
      payload: {},
      correlationId: 'correlation-0001',
    });

    const completed = await executor.execute(queued.operationId);

    expect(completed.status).toBe('succeeded');
    expect(completed.attempt).toBe(3);
    expect(delays).toEqual([250, 500]);
  });

  test('records a permanent failure without retrying', async () => {
    const executor = new OperationExecutor({
      store: new InMemoryOperationStore(),
      coordinator: new InMemoryMutationCoordinator(),
      handlers: { mutate: async () => Promise.reject(new Error('invalid')) },
      classifyError: () => ({ category: 'validation', retryable: false }),
      log: () => {},
    });
    const queued = await executor.submit({
      idempotencyKey: 'request-key-00000001',
      actor: { type: 'service', subjectId: 'service-00000001' },
      resource: { type: 'config', id: 'access' },
      action: 'mutate',
      payload: {},
      correlationId: 'correlation-0001',
    });

    const completed = await executor.execute(queued.operationId);

    expect(completed.status).toBe('failed');
    expect(completed.attempt).toBe(1);
    expect(completed.lastErrorCategory).toBe('validation');
  });
});
