import { describe, expect, test } from 'bun:test';

import { invokeWorker } from 'test/helpers/invoke-worker';

const ALLOWED_ORIGIN = 'https://portal.scs-pdn.space';
const DISALLOWED_ORIGIN = 'https://untrusted.example';
const ALLOWED_METHODS = 'PATCH, POST, GET, OPTIONS, PUT, DELETE';
const ALLOWED_HEADERS = 'Content-Type, Authorization, X-Client-Id';

describe('edge routing and CORS characterization', () => {
  test('mounts Better Auth before the application route fallback', async () => {
    const response = await invokeWorker('/api/auth/ok', {
      method: 'GET',
      headers: {
        Origin: ALLOWED_ORIGIN,
        'X-Client-Id': 'portal',
      },
    });

    expect(response.status).toBe(200);
    expect((await response.json()) as unknown).toEqual({ ok: true });
  });

  test('allows preflight requests from an allowed origin', async () => {
    const response = await invokeWorker('/api/me', {
      method: 'OPTIONS',
      headers: { Origin: ALLOWED_ORIGIN },
    });

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      ALLOWED_ORIGIN
    );
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe(
      'true'
    );
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
      ALLOWED_METHODS
    );
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
      ALLOWED_HEADERS
    );
  });

  test('rejects disallowed preflight while echoing its origin', async () => {
    const response = await invokeWorker('/api/me', {
      method: 'OPTIONS',
      headers: { Origin: DISALLOWED_ORIGIN },
    });

    expect(response.status).toBe(403);
    expect((await response.json()) as unknown).toEqual({
      error: 'Forbidden',
    });
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      DISALLOWED_ORIGIN
    );
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe(
      'true'
    );
  });

  test('returns the current response for an unknown route', async () => {
    const response = await invokeWorker('/does-not-exist', {
      method: 'GET',
      headers: { Origin: ALLOWED_ORIGIN },
    });

    expect(response.status).toBe(404);
    expect((await response.json()) as unknown).toEqual({
      error: 'Not Found',
    });
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      ALLOWED_ORIGIN
    );
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe(
      'true'
    );
  });

  test('returns 405 without CORS for an unsupported method', async () => {
    const response = await invokeWorker('/api/me', {
      method: 'DELETE',
      headers: { Origin: ALLOWED_ORIGIN },
    });

    expect(response.status).toBe(405);
    expect((await response.json()) as unknown).toEqual({
      error: 'Method Not Allowed',
    });
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
  });

  test('adds CORS headers to an allowed-origin dispatched response', async () => {
    const response = await invokeWorker('/api/me', {
      method: 'GET',
      headers: { Origin: ALLOWED_ORIGIN },
    });

    expect(response.status).toBe(401);
    expect(await response.text()).toBe('Unauthorized');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      ALLOWED_ORIGIN
    );
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe(
      'true'
    );
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
      ALLOWED_METHODS
    );
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
      ALLOWED_HEADERS
    );
  });
});
