import { describe, expect, test } from 'bun:test';
import type { MutationAccepted } from '@scs/schemas';

import { waitForMutationOperation } from '@/lib/mutation-operation';

const accepted: MutationAccepted = {
  version: 1,
  operationId: 'operation-123456789',
  status: 'queued',
  statusUrl: '/api/operations/operation-123456789',
  retryAfterMs: 250,
};

function terminalResponse(status: 'succeeded' | 'failed' | 'conflicted') {
  return new Response(
    JSON.stringify({
      version: 1,
      operationId: accepted.operationId,
      status,
      resource: { type: 'project', id: 'project-one' },
      actor: { type: 'user', subjectId: 'subject-123456789' },
      createdAt: '2026-10-21T00:00:00.000Z',
      updatedAt: '2026-10-21T00:00:01.000Z',
      completedAt: '2026-10-21T00:00:01.000Z',
      outcome:
        status === 'succeeded'
          ? { status: 'succeeded' }
          : {
              status,
              error: { code: 'operation_failed', message: status },
            },
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

describe('mutation operation polling', () => {
  for (const status of ['succeeded', 'failed', 'conflicted'] as const) {
    test(`stops when an operation is ${status}`, async () => {
      let requests = 0;
      const result = await waitForMutationOperation(accepted, 'pending', {
        fetcher: async () => {
          requests += 1;
          return terminalResponse(status);
        },
        wait: async () => undefined,
      });

      expect(result.status).toBe(status);
      expect(requests).toBe(1);
    });
  }

  test('stops before another request when its owner unmounts', async () => {
    const controller = new AbortController();
    let requests = 0;

    const polling = waitForMutationOperation(accepted, 'pending', {
      signal: controller.signal,
      fetcher: async () => {
        requests += 1;
        return terminalResponse('succeeded');
      },
      wait: async (_delayMs, signal) => {
        controller.abort();
        signal?.throwIfAborted();
      },
    });

    await expect(polling).rejects.toMatchObject({ name: 'AbortError' });
    expect(requests).toBe(0);
  });
});
