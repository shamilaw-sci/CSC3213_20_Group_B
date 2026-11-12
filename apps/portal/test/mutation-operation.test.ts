import { describe, expect, test } from 'bun:test';
import type { MutationAccepted } from '@scs/schemas';

import {
  readAcceptedMutation,
  stableMutationKey,
  waitForMutationOperation,
} from '@/lib/mutation-operation';

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
              error: {
                code: 'operation_failed',
                message: status,
                correlationId: 'req_01JAA2V8M7X4G9NK2QF6D3P1ZT',
              },
            },
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

describe('mutation operation polling', () => {
  test('reuses a key after network uncertainty and restores an accepted operation', async () => {
    const previousWindow = Object.getOwnPropertyDescriptor(
      globalThis,
      'window'
    );
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => values.get(key) ?? null,
          setItem: (key: string, value: string) => values.set(key, value),
          removeItem: (key: string) => values.delete(key),
        },
      },
    });
    try {
      const first = await stableMutationKey('projects', { slug: 'example' });
      const retry = await stableMutationKey('projects', { slug: 'example' });
      const changed = await stableMutationKey('projects', { slug: 'other' });
      expect(retry).toBe(first);
      expect(changed).not.toBe(first);

      values.set('scs-public-mutation:projects', JSON.stringify(accepted));
      expect(readAcceptedMutation('projects')).toEqual({ accepted });
      values.set(
        'scs-public-mutation:projects',
        JSON.stringify({ accepted, pendingDeletionResourceId: 'example' })
      );
      expect(readAcceptedMutation('projects')).toEqual({
        accepted,
        pendingDeletionResourceId: 'example',
      });
    } finally {
      if (previousWindow) {
        Object.defineProperty(globalThis, 'window', previousWindow);
      } else {
        Reflect.deleteProperty(globalThis, 'window');
      }
    }
  });

  test('polls relative operation paths on the API origin', async () => {
    let requestedUrl: RequestInfo | URL | undefined;

    await waitForMutationOperation(accepted, 'pending', {
      fetcher: async (input) => {
        requestedUrl = input;
        return terminalResponse('succeeded');
      },
      wait: async () => undefined,
    });

    expect(String(requestedUrl)).toBe(
      'https://api.scs-pdn.space/api/operations/operation-123456789'
    );
  });

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

  test('rejects a malformed operation status at the polling boundary', async () => {
    await expect(
      waitForMutationOperation(accepted, 'pending', {
        fetcher: async () => Response.json({ status: 'succeeded' }),
        wait: async () => undefined,
      })
    ).rejects.toThrow();
  });
});
