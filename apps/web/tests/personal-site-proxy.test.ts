// @vitest-environment node

import { NextRequest } from 'next/server';
import { afterEach, describe, expect, test, vi } from 'vitest';

import proxy from '@/proxy';

const SUPPORTED_METHODS = [
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
] as const;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stubResolution(destination: string) {
  const fetchMock = vi.fn(
    async (request: RequestInfo | URL, init?: RequestInit) => {
      const url = request instanceof Request ? request.url : request.toString();
      expect(url).toBe(
        'https://api.scs-pdn.space/api/internal/proxies/student-01'
      );
      const headers = new Headers(
        request instanceof Request ? request.headers : init?.headers
      );
      expect(headers.get('X-Internal-Secret')).toBe(
        'development-only-proxy-secret'
      );
      expect(init?.method).toBe('GET');
      expect(init?.cache).toBe('no-store');
      return Response.json({ url: destination });
    }
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('personal-site redirects', () => {
  test.each(SUPPORTED_METHODS)(
    'redirects %s without consuming its body',
    async (method) => {
      stubResolution('https://portfolio.example/student/');

      const carriesBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
      const request = new NextRequest(
        'https://scs.pdn.space/~Student-01/portfolio',
        {
          method,
          ...(carriesBody ? { body: 'unread-payload' } : {}),
        }
      );
      const response = await proxy(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe(
        'https://portfolio.example/student/portfolio'
      );
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.has('x-middleware-rewrite')).toBe(false);
      expect(request.bodyUsed).toBe(false);
    }
  );

  test('preserves a destination base path, trailing slash, query, and encoded path data', async () => {
    stubResolution('https://portfolio.example/published/student');

    const response = await proxy(
      new NextRequest(
        'https://scs.pdn.space/~Student-01/Work/%E2%9C%93%20Case/%2Fkeep/?ref=One&encoded=%2Fkeep'
      )
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://portfolio.example/published/student/Work/%E2%9C%93%20Case/%2Fkeep/?ref=One&encoded=%2Fkeep'
    );
  });

  test('keeps path-like input on the configured destination origin', async () => {
    stubResolution('https://portfolio.example/student/');

    const response = await proxy(
      new NextRequest(
        'https://scs.pdn.space/~Student-01//attacker.example/path'
      )
    );

    expect(response.headers.get('location')).toBe(
      'https://portfolio.example/student//attacker.example/path'
    );
  });

  test('rewrites a missing GET mapping through the themed not-found page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 404 }))
    );

    const response = await proxy(
      new NextRequest('https://scs.pdn.space/~missing/path')
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.has('location')).toBe(false);
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      'https://scs.pdn.space/personal-site-not-found'
    );
  });

  test.each(SUPPORTED_METHODS.filter((method) => method !== 'GET'))(
    'returns a plain non-cacheable 404 for a missing %s mapping',
    async (method) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(null, { status: 404 }))
      );

      const response = await proxy(
        new NextRequest('https://scs.pdn.space/~missing/path', { method })
      );

      expect(response.status).toBe(404);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.has('location')).toBe(false);
      expect(response.headers.has('x-middleware-rewrite')).toBe(false);
      expect(await response.text()).toBe('');
    }
  );

  test('rejects an unsafe destination instead of redirecting', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ url: 'http://public.example/path' }))
    );

    const response = await proxy(
      new NextRequest('https://scs.pdn.space/~student-01/path')
    );

    expect(response.status).toBe(502);
    expect(response.headers.has('location')).toBe(false);
    expect(consoleError).toHaveBeenCalledOnce();
  });

  test('resolves every request so destination changes are immediate', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ url: 'https://first.example/student/' })
      )
      .mockResolvedValueOnce(
        Response.json({ url: 'https://second.example/student/' })
      );
    vi.stubGlobal('fetch', fetchMock);

    const requestUrl = 'https://scs.pdn.space/~student-01/work';
    const first = await proxy(new NextRequest(requestUrl));
    const second = await proxy(new NextRequest(requestUrl));

    expect(first.headers.get('location')).toBe(
      'https://first.example/student/work'
    );
    expect(second.headers.get('location')).toBe(
      'https://second.example/student/work'
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
