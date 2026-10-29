import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { callGithubApp } from '@/clients/github-app.client';

import { createTestEnv } from 'test/helpers/create-test-env';

afterEach(() => {
  (globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.();
});

describe('GitHub App client', () => {
  test('uses the HTTP fallback with authentication and correlation headers', async () => {
    const fetchMock = spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ status: 'open' })
    );

    const result = await callGithubApp<{ status: string }>(
      createTestEnv(),
      'https://portal.scs-pdn.space',
      '/projects/public-project/pr?slug=example'
    );

    expect(result).toEqual({ ok: true, value: { status: 'open' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(headers.get('X-Internal-Secret')).toBe(
      'test-github-app-internal-secret'
    );
    expect(headers.get('X-Correlation-Id')).toBeTruthy();
  });

  test('prefers a service binding and maps versioned upstream errors', async () => {
    const serviceCalls: Request[] = [];
    const env = createTestEnv({
      GITHUB_APP: {
        async fetch(input: RequestInfo | URL, init?: RequestInit) {
          const request = new Request(input, init);
          serviceCalls.push(request);
          return Response.json(
            {
              version: 1,
              error: {
                code: 'entity_revision_conflict',
                message: 'Refresh before submitting again.',
                correlationId: 'req_01JAA2V8M7X4G9NK2QF6D3P1ZT',
              },
            },
            { status: 409 }
          );
        },
      } as Fetcher,
    });
    const fallback = spyOn(globalThis, 'fetch');

    const result = await callGithubApp(
      env,
      'https://portal.scs-pdn.space',
      '/projects/public-project/pr'
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(409);
      expect((await result.response.json()) as unknown).toEqual({
        code: 'entity_revision_conflict',
        error: 'Refresh before submitting again.',
      });
    }
    expect(serviceCalls).toHaveLength(1);
    expect(fallback).not.toHaveBeenCalled();
  });

  test('preserves safe validation details from the GitHub App', async () => {
    const env = createTestEnv({
      GITHUB_APP: {
        fetch: () =>
          Promise.resolve(
            Response.json(
              {
                success: false,
                message: 'Invalid request',
                field: 'request.aggregatePaths',
                reason: 'Aggregate paths must match profile kind and identity',
              },
              { status: 400 }
            )
          ),
      } as unknown as Fetcher,
    });

    const result = await callGithubApp(
      env,
      'https://portal.scs-pdn.space',
      '/people/public-profile/operations'
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(await result.response.json()).toEqual({
        error: 'Invalid request',
        message: 'Aggregate paths must match profile kind and identity',
        field: 'request.aggregatePaths',
        reason: 'Aggregate paths must match profile kind and identity',
      });
    }
  });

  test('maps a timed-out request to a stable gateway error', async () => {
    const timedOutFetch = async (
      _input: RequestInfo | URL,
      init?: RequestInit
    ) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError'))
        );
      });
    spyOn(globalThis, 'fetch').mockImplementation(
      timedOutFetch as typeof fetch
    );

    const result = await callGithubApp(
      createTestEnv(),
      'https://portal.scs-pdn.space',
      '/slow',
      undefined,
      { timeoutMs: 5 }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(504);
      expect((await result.response.json()) as unknown).toEqual({
        code: 'github_app_timeout',
        error: 'GitHub App request timed out',
      });
    }
  });
});
