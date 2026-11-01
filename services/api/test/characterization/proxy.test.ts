import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';

import { PROXY_ATTEMPTS_RESET_WINDOW_MS } from '@/config/client.config';
import {
  ACCESS_LEVEL,
  APP_ROLE,
  setUserPermission as persistUserPermission,
  type Permission,
} from '@/repositories/permissions.repo';
import type { Env } from '@/types/env';

import { createTestEnv } from 'test/helpers/create-test-env';
import { createTestSessionCookie } from 'test/helpers/create-test-session';
import { invokeWorker } from 'test/helpers/invoke-worker';

const ALLOWED_ORIGIN = 'https://portal.scs-pdn.space';
const ALLOWED_CLIENT_ID = 'portal';
const USER_EMAIL = 'student@pdn.ac.lk';
const OTHER_EMAIL = 'other@pdn.ac.lk';
const ADMIN_EMAIL = 'admin@pdn.ac.lk';
const FIXED_NOW = Date.parse('2026-07-28T12:00:00.000Z');

async function setPermission(
  env: Env,
  email: string,
  permission: Partial<Permission>
): Promise<void> {
  await persistUserPermission(
    email,
    { ...permission, role: permission.role ?? APP_ROLE.STUDENT },
    env
  );
}

async function seedProxy(
  env: Env,
  input: {
    email: string;
    active?: boolean;
    url?: string;
    availableAttempts?: number;
    attemptWindowStartedAt?: number | null;
    updatedAt?: number | null;
    updatedBy?: string | null;
  }
): Promise<void> {
  await env.AUTH_DB.prepare(
    'INSERT INTO proxySettings (email, username, active, url, availableAttempts, attemptWindowStartedAt, updatedAt, updatedBy, revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)'
  )
    .bind(
      input.email,
      input.email.split('@')[0],
      input.active ?? false,
      input.url ?? '',
      input.availableAttempts ?? 5,
      input.attemptWindowStartedAt ?? null,
      input.updatedAt ?? null,
      input.updatedBy ?? null
    )
    .run();
}

function proxyRequest(
  path: string,
  method: string,
  env: Env,
  options: { token?: string; body?: unknown; internalSecret?: string } = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    Origin: ALLOWED_ORIGIN,
    'X-Client-Id': ALLOWED_CLIENT_ID,
  };
  if (options.token) headers.Cookie = options.token;
  if (options.internalSecret) {
    headers['X-Internal-Secret'] = options.internalSecret;
  }
  let body: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  return invokeWorker(path, { method, headers, body }, env);
}

beforeEach(() => {
  spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
});

afterEach(() => {
  (Date.now as unknown as { mockRestore?: () => void }).mockRestore?.();
});

describe('D1-backed proxy settings', () => {
  test('resolves an active proxy by username for the Web server', async () => {
    const env = createTestEnv();
    await seedProxy(env, {
      email: USER_EMAIL,
      active: true,
      url: 'https://portfolio.example/student/',
    });

    const response = await proxyRequest(
      '/api/internal/proxies/student',
      'GET',
      env,
      { internalSecret: env.WEB_PROXY_INTERNAL_SECRET }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      url: 'https://portfolio.example/student/',
    });
  });

  test('does not expose proxy resolution without the internal secret', async () => {
    const env = createTestEnv();
    await seedProxy(env, {
      email: USER_EMAIL,
      active: true,
      url: 'https://portfolio.example/student/',
    });

    const response = await proxyRequest(
      '/api/internal/proxies/student',
      'GET',
      env
    );

    expect(response.status).toBe(401);
  });

  test('hides missing, inactive, and malformed proxy usernames', async () => {
    const env = createTestEnv();
    await seedProxy(env, { email: USER_EMAIL, active: false });

    for (const [path, status] of [
      ['/api/internal/proxies/student', 404],
      ['/api/internal/proxies/missing', 404],
      ['/api/internal/proxies/student%2Fadmin', 400],
    ] as const) {
      const response = await proxyRequest(path, 'GET', env, {
        internalSecret: env.WEB_PROXY_INTERNAL_SECRET,
      });
      expect(response.status, path).toBe(status);
    }
  });

  test('does not resolve an ambiguous active username', async () => {
    const env = createTestEnv();
    await seedProxy(env, {
      email: USER_EMAIL,
      active: true,
      url: 'https://first.example/student/',
    });
    await seedProxy(env, {
      email: 'student@sci.pdn.ac.lk',
      active: true,
      url: 'https://second.example/student/',
    });

    const response = await proxyRequest(
      '/api/internal/proxies/student',
      'GET',
      env,
      { internalSecret: env.WEB_PROXY_INTERNAL_SECRET }
    );

    expect(response.status).toBe(404);
  });

  test('requires authentication', async () => {
    const response = await proxyRequest(
      '/api/me/proxy',
      'GET',
      createTestEnv()
    );
    expect(response.status).toBe(401);
  });

  test('returns default settings without creating a row', async () => {
    const env = createTestEnv();
    await setPermission(env, USER_EMAIL, {});
    const token = await createTestSessionCookie(env, USER_EMAIL);

    const response = await proxyRequest('/api/me/proxy', 'GET', env, { token });
    const body = (await response.json()) as {
      proxy: { email: string; active: boolean; availableAttempts: number };
    };
    const count = await env.AUTH_DB.prepare(
      'SELECT count(*) AS total FROM proxySettings'
    ).first<{ total: number }>();

    expect(response.status).toBe(200);
    expect(body.proxy).toMatchObject({
      email: USER_EMAIL,
      active: false,
      availableAttempts: 5,
    });
    expect(count?.total).toBe(0);
  });

  test('atomically consumes one edit attempt and persists settings', async () => {
    const env = createTestEnv();
    await setPermission(env, USER_EMAIL, {});
    const token = await createTestSessionCookie(env, USER_EMAIL);

    const update = await proxyRequest('/api/me/proxy', 'POST', env, {
      token,
      body: { active: true, url: 'https://proxy.example/student' },
    });
    const read = await proxyRequest('/api/me/proxy', 'GET', env, { token });
    const body = (await read.json()) as {
      proxy: { active: boolean; url: string; availableAttempts: number };
    };

    expect(update.status).toBe(200);
    expect(body.proxy).toMatchObject({
      active: true,
      url: 'https://proxy.example/student',
      availableAttempts: 4,
    });
  });

  test('never allows concurrent edits to consume more than five attempts', async () => {
    const env = createTestEnv();
    await setPermission(env, USER_EMAIL, {});
    const token = await createTestSessionCookie(env, USER_EMAIL);

    const responses = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        proxyRequest('/api/me/proxy', 'POST', env, {
          token,
          body: { active: true, url: `https://proxy.example/${index}` },
        })
      )
    );
    const statuses = responses.map((response) => response.status).sort();
    const row = await env.AUTH_DB.prepare(
      'SELECT availableAttempts FROM proxySettings WHERE email = ?'
    )
      .bind(USER_EMAIL)
      .first<{ availableAttempts: number }>();

    expect(statuses).toEqual([200, 200, 200, 200, 200, 409]);
    expect(row?.availableAttempts).toBe(0);
  });

  test('starts a fresh attempt window after the previous window expires', async () => {
    const env = createTestEnv();
    await setPermission(env, USER_EMAIL, {});
    await seedProxy(env, {
      email: USER_EMAIL,
      active: false,
      availableAttempts: 0,
      attemptWindowStartedAt:
        FIXED_NOW - PROXY_ATTEMPTS_RESET_WINDOW_MS - 60_000,
    });
    const token = await createTestSessionCookie(env, USER_EMAIL);

    const response = await proxyRequest('/api/me/proxy', 'POST', env, {
      token,
      body: { active: true, url: 'https://proxy.example/refreshed' },
    });
    const body = (await response.json()) as {
      proxy: { availableAttempts: number };
    };

    expect(response.status).toBe(200);
    expect(body.proxy.availableAttempts).toBe(4);
  });

  test('allows an admin edit without consuming the target attempts', async () => {
    const env = createTestEnv();
    await setPermission(env, ADMIN_EMAIL, {
      accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
      role: APP_ROLE.ACADEMIC,
    });
    await setPermission(env, OTHER_EMAIL, {});
    await seedProxy(env, { email: OTHER_EMAIL, availableAttempts: 2 });
    const token = await createTestSessionCookie(env, ADMIN_EMAIL);

    const response = await proxyRequest('/api/me/proxy', 'POST', env, {
      token,
      body: {
        email: OTHER_EMAIL,
        active: true,
        url: 'https://proxy.example/admin-updated',
      },
    });
    const body = (await response.json()) as {
      proxy: { availableAttempts: number; updatedBy: string };
    };

    expect(response.status).toBe(200);
    expect(body.proxy).toMatchObject({
      availableAttempts: 2,
      updatedBy: ADMIN_EMAIL,
    });
  });

  test('resets attempts through the admin endpoint', async () => {
    const env = createTestEnv();
    await setPermission(env, ADMIN_EMAIL, {
      accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
      role: APP_ROLE.ACADEMIC,
    });
    await setPermission(env, OTHER_EMAIL, {});
    await seedProxy(env, { email: OTHER_EMAIL, availableAttempts: 0 });
    const token = await createTestSessionCookie(env, ADMIN_EMAIL);

    const response = await proxyRequest(
      '/api/admin/proxies/reset-attempts',
      'POST',
      env,
      { token, body: { email: OTHER_EMAIL } }
    );
    const body = (await response.json()) as {
      proxy: { availableAttempts: number; updatedBy: string };
    };

    expect(response.status).toBe(200);
    expect(body.proxy).toMatchObject({
      availableAttempts: 5,
      updatedBy: ADMIN_EMAIL,
    });
  });

  test('does not expose a self-service attempt reset route', async () => {
    const env = createTestEnv();
    await setPermission(env, USER_EMAIL, {});
    const token = await createTestSessionCookie(env, USER_EMAIL);

    const response = await proxyRequest('/api/me/proxy/reset', 'POST', env, {
      token,
      body: { email: USER_EMAIL },
    });

    expect(response.status).toBe(404);
  });

  test('forbids non-admin access to proxy pages', async () => {
    const env = createTestEnv();
    await setPermission(env, USER_EMAIL, {});
    const token = await createTestSessionCookie(env, USER_EMAIL);

    const response = await proxyRequest('/api/admin/proxies/page', 'GET', env, {
      token,
    });

    expect(response.status).toBe(403);
  });

  test('returns stable bounded D1 pages without upstream fetches', async () => {
    const env = createTestEnv();
    await setPermission(env, ADMIN_EMAIL, {
      accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
      role: APP_ROLE.ACADEMIC,
    });
    await seedProxy(env, { email: 'zulu@pdn.ac.lk' });
    await seedProxy(env, { email: 'alpha@pdn.ac.lk' });
    const token = await createTestSessionCookie(env, ADMIN_EMAIL);
    const fetchMock = spyOn(globalThis, 'fetch');

    const firstResponse = await proxyRequest(
      '/api/admin/proxies/page?limit=1',
      'GET',
      env,
      { token }
    );
    const first = (await firstResponse.json()) as {
      items: Array<{ email: string }>;
      page: { nextCursor: string; hasMore: boolean; total: number };
    };
    const secondResponse = await proxyRequest(
      `/api/admin/proxies/page?limit=1&cursor=${encodeURIComponent(first.page.nextCursor)}`,
      'GET',
      env,
      { token }
    );
    const second = (await secondResponse.json()) as {
      items: Array<{ email: string }>;
      page: { nextCursor: null; hasMore: boolean; total: number };
    };

    expect(firstResponse.status).toBe(200);
    expect(first.items.map(({ email }) => email)).toEqual(['alpha@pdn.ac.lk']);
    expect(first.page).toMatchObject({ hasMore: true, total: 2 });
    expect(secondResponse.status).toBe(200);
    expect(second.items.map(({ email }) => email)).toEqual(['zulu@pdn.ac.lk']);
    expect(second.page).toEqual({
      nextCursor: null,
      hasMore: false,
      total: 2,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  test('rejects page sizes above the shared maximum', async () => {
    const env = createTestEnv();
    await setPermission(env, ADMIN_EMAIL, {
      accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
      role: APP_ROLE.ACADEMIC,
    });
    const token = await createTestSessionCookie(env, ADMIN_EMAIL);
    const response = await proxyRequest(
      '/api/admin/proxies/page?limit=101',
      'GET',
      env,
      { token }
    );
    expect(response.status).toBe(400);
  });

  test('rejects legacy proxyUrl update bodies', async () => {
    const env = createTestEnv();
    await setPermission(env, USER_EMAIL, {});
    const token = await createTestSessionCookie(env, USER_EMAIL);
    const response = await proxyRequest('/api/me/proxy', 'POST', env, {
      token,
      body: { active: true, proxyUrl: 'https://proxy.example/legacy' },
    });
    expect(response.status).toBe(400);
  });
});
