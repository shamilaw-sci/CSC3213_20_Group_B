import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { SignJWT } from 'jose';

import { PROXY_ATTEMPTS_RESET_WINDOW_MS } from '@/config/client.config';
import {
  ACCESS_LEVEL,
  APP_ROLE,
  type Permission,
} from '@/repositories/permissions.repo';
import type { Env } from '@/types/env';

import { createTestEnv } from 'test/helpers/create-test-env';
import { invokeWorker } from 'test/helpers/invoke-worker';

const ALLOWED_ORIGIN = 'https://portal.scs-pdn.space';
const ALLOWED_CLIENT_ID = 'portal';
const USER_EMAIL = 'student@pdn.ac.lk';
const OTHER_EMAIL = 'other@pdn.ac.lk';
const ADMIN_EMAIL = 'admin@pdn.ac.lk';
const FIXED_NOW = Date.parse('2026-07-28T12:00:00.000Z');
const RECENT_UPDATED_AT = new Date(FIXED_NOW - 60_000).toISOString();
const EXPIRED_UPDATED_AT = new Date(
  FIXED_NOW - PROXY_ATTEMPTS_RESET_WINDOW_MS - 60_000
).toISOString();

interface ProxyConfig {
  active: boolean;
  url: string;
  availableAttempts: number;
  updatedAt?: string;
  updatedBy?: string;
}

async function createSessionToken(env: Env, email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(email)
    .setIssuer(env.JWT_ISSUER)
    .setAudience(ALLOWED_CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime('1h')
    .setJti(crypto.randomUUID())
    .sign(new TextEncoder().encode(env.JWT_SECRET));
}

async function setPermission(
  env: Env,
  email: string,
  permission: Partial<Permission>
): Promise<void> {
  await env.PERMISSIONS.put(
    `permissions:${email.toLowerCase()}`,
    JSON.stringify({ ...permission, role: permission.role ?? APP_ROLE.STUDENT })
  );
}

function proxyRequest(
  method: string,
  env: Env,
  options: {
    query?: string;
    token?: string;
    clientId?: string | null;
    body?: unknown;
  } = {}
): Promise<Response> {
  const headers: Record<string, string> = { Origin: ALLOWED_ORIGIN };
  if (options.token) {
    headers.Cookie = `session=${options.token}`;
  }
  if (options.clientId !== null) {
    headers['X-Client-Id'] = options.clientId ?? ALLOWED_CLIENT_ID;
  }

  let body: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  return invokeWorker(
    `/user/proxy${options.query ?? ''}`,
    { method, headers, body },
    env
  );
}

function proxyPathRequest(
  path: string,
  method: string,
  env: Env,
  options: {
    token?: string;
    clientId?: string | null;
    body?: unknown;
  } = {}
): Promise<Response> {
  const headers: Record<string, string> = { Origin: ALLOWED_ORIGIN };
  if (options.token) {
    headers.Cookie = `session=${options.token}`;
  }
  if (options.clientId !== null) {
    headers['X-Client-Id'] = options.clientId ?? ALLOWED_CLIENT_ID;
  }

  let body: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  return invokeWorker(path, { method, headers, body }, env);
}

function installGithubAppMock(configs: Record<string, ProxyConfig>) {
  const writes: Array<{ username: string; body: Record<string, unknown> }> = [];
  const mock = (
    spyOn(globalThis, 'fetch') as unknown as {
      mockImplementation: (
        implementation: (
          input: RequestInfo | URL,
          init?: RequestInit
        ) => Promise<Response>
      ) => unknown;
    }
  ).mockImplementation(async (input, init) => {
    const url = new URL(input.toString());
    expect(init?.headers).toBeDefined();

    if (url.pathname === '/user/access-config') {
      const username = url.searchParams.get('username') ?? '';
      return Response.json({
        proxy: configs[username] ?? {
          active: false,
          url: '',
          availableAttempts: 5,
        },
        permissions: { repo: {} },
      });
    }

    if (url.pathname === '/user/proxy-settings') {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<
        string,
        unknown
      >;
      const username = String(body.username);
      writes.push({ username, body });
      configs[username] = {
        active: body.active === true,
        url: String(body.url ?? ''),
        availableAttempts: Number(body.availableAttempts),
        updatedAt: new Date().toISOString(),
        updatedBy: String(body.updatedBy ?? ''),
      };
      return Response.json({
        success: true,
        automation: {
          pullRequest: { number: 1, url: 'https://example.com/pr/1' },
        },
      });
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  });

  return { mock, writes };
}

beforeEach(() => {
  spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
});

afterEach(() => {
  (Date.now as unknown as { mockRestore?: () => void }).mockRestore?.();
  (globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.();
});

describe('/user/proxy repo-backed config characterization', () => {
  test('requires authentication', async () => {
    const response = await proxyRequest('GET', createTestEnv());

    expect(response.status).toBe(401);
    expect(await response.text()).toBe('Unauthorized');
  });

  test('returns the current user proxy config from the GitHub App', async () => {
    const env = createTestEnv();
    await setPermission(env, USER_EMAIL, {});
    const token = await createSessionToken(env, USER_EMAIL);
    const { writes } = installGithubAppMock({
      student: {
        active: true,
        url: 'https://proxy.example/current',
        availableAttempts: 4,
        updatedAt: '2026-07-28T00:00:00.000Z',
        updatedBy: USER_EMAIL,
      },
    });

    const response = await proxyRequest('GET', env, { token });
    const body = (await response.json()) as {
      isAllowed: boolean;
      canEdit: boolean;
      proxy: ProxyConfig;
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      isAllowed: true,
      canEdit: true,
      proxy: {
        active: true,
        url: 'https://proxy.example/current',
        availableAttempts: 4,
        updatedAt: '2026-07-28T00:00:00.000Z',
        updatedBy: USER_EMAIL,
      },
    });
    expect(writes).toEqual([]);
  });

  test('decrements a non-admin edit attempt and writes the config PR payload', async () => {
    const env = createTestEnv();
    await setPermission(env, USER_EMAIL, {});
    const token = await createSessionToken(env, USER_EMAIL);
    const { writes } = installGithubAppMock({
      student: {
        active: false,
        url: '',
        availableAttempts: 5,
        updatedAt: '2026-07-28T00:00:00.000Z',
        updatedBy: USER_EMAIL,
      },
    });

    const response = await proxyRequest('PATCH', env, {
      token,
      body: { active: true, url: 'https://proxy.example/updated' },
    });
    const body = (await response.json()) as { proxy: ProxyConfig };

    expect(response.status).toBe(200);
    expect(body.proxy).toEqual({
      active: true,
      url: 'https://proxy.example/updated',
      availableAttempts: 4,
      updatedAt: '2026-07-28T00:00:00.000Z',
      updatedBy: USER_EMAIL,
    });
    expect(writes).toEqual([
      {
        username: 'student',
        body: {
          username: 'student',
          email: USER_EMAIL,
          updatedBy: USER_EMAIL,
          active: true,
          url: 'https://proxy.example/updated',
          availableAttempts: 4,
        },
      },
    ]);
  });

  test('rejects a non-admin edit when attempts are exhausted', async () => {
    const env = createTestEnv();
    await setPermission(env, USER_EMAIL, {});
    const token = await createSessionToken(env, USER_EMAIL);
    const { writes } = installGithubAppMock({
      student: {
        active: true,
        url: 'https://proxy.example/current',
        availableAttempts: 0,
        updatedAt: RECENT_UPDATED_AT,
        updatedBy: USER_EMAIL,
      },
    });

    const response = await proxyRequest('PATCH', env, {
      token,
      body: { active: true, url: 'https://proxy.example/updated' },
    });

    expect(response.status).toBe(409);
    expect((await response.json()) as unknown).toEqual({
      code: 'proxy_attempts_exhausted',
      message: 'You have used all your editing attempts for today.',
    });
    expect(writes).toEqual([]);
  });

  test('resets stale attempts before a non-admin edit', async () => {
    const env = createTestEnv();
    await setPermission(env, USER_EMAIL, {});
    const token = await createSessionToken(env, USER_EMAIL);
    const { writes } = installGithubAppMock({
      student: {
        active: true,
        url: 'https://proxy.example/current',
        availableAttempts: 0,
        updatedAt: EXPIRED_UPDATED_AT,
        updatedBy: USER_EMAIL,
      },
    });

    const response = await proxyRequest('PATCH', env, {
      token,
      body: { active: true, url: 'https://proxy.example/updated' },
    });

    expect(response.status).toBe(200);
    expect(writes[0]?.body.availableAttempts).toBe(4);
  });

  test('allows a super-admin to edit another user without decrementing attempts', async () => {
    const env = createTestEnv();
    await setPermission(env, ADMIN_EMAIL, {
      accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
      role: APP_ROLE.ACADEMIC,
    });
    await setPermission(env, OTHER_EMAIL, {});
    const token = await createSessionToken(env, ADMIN_EMAIL);
    const { writes } = installGithubAppMock({
      other: {
        active: false,
        url: '',
        availableAttempts: 2,
        updatedAt: RECENT_UPDATED_AT,
        updatedBy: OTHER_EMAIL,
      },
    });

    const response = await proxyRequest('POST', env, {
      token,
      body: {
        email: OTHER_EMAIL,
        active: true,
        url: 'https://proxy.example/admin-updated',
      },
    });

    expect(response.status).toBe(200);
    expect(writes[0]).toEqual({
      username: 'other',
      body: {
        username: 'other',
        email: OTHER_EMAIL,
        updatedBy: ADMIN_EMAIL,
        active: true,
        url: 'https://proxy.example/admin-updated',
        availableAttempts: 2,
      },
    });
  });

  test('resets attempts through the admin reset endpoint', async () => {
    const env = createTestEnv();
    await setPermission(env, ADMIN_EMAIL, {
      accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
      role: APP_ROLE.ACADEMIC,
    });
    await setPermission(env, OTHER_EMAIL, {});
    const token = await createSessionToken(env, ADMIN_EMAIL);
    const { writes } = installGithubAppMock({
      other: {
        active: true,
        url: 'https://proxy.example/current',
        availableAttempts: 0,
        updatedAt: '2026-07-28T00:00:00.000Z',
        updatedBy: OTHER_EMAIL,
      },
    });

    const response = await proxyPathRequest(
      '/api/admin/proxy/reset-attempts',
      'POST',
      env,
      {
        token,
        body: { email: OTHER_EMAIL },
      }
    );

    expect(response.status).toBe(200);
    expect(writes[0]).toEqual({
      username: 'other',
      body: {
        username: 'other',
        email: OTHER_EMAIL,
        updatedBy: ADMIN_EMAIL,
        active: true,
        url: 'https://proxy.example/current',
        availableAttempts: 5,
      },
    });
  });

  test('rejects legacy proxyUrl update bodies', async () => {
    const env = createTestEnv();
    await setPermission(env, USER_EMAIL, {});
    const token = await createSessionToken(env, USER_EMAIL);
    installGithubAppMock({});

    const response = await proxyRequest('PATCH', env, {
      token,
      body: { active: true, proxyUrl: 'https://proxy.example/legacy' },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: 'invalid_proxy_update',
    });
  });

  test('returns a short-lived signed read URL for the current user proxy file', async () => {
    const env = createTestEnv();
    await setPermission(env, USER_EMAIL, {});
    const token = await createSessionToken(env, USER_EMAIL);

    const response = await proxyPathRequest(
      '/user/proxy/read-url',
      'GET',
      env,
      { token }
    );
    const body = (await response.json()) as {
      url: string;
      expiresAt: string;
    };
    const signedUrl = new URL(body.url);

    expect(response.status).toBe(200);
    expect(signedUrl.origin).toBe('https://config.test.scs-pdn.space');
    expect(signedUrl.pathname).toBe('/config/v1/student.json');
    expect(signedUrl.searchParams.get('access_token')).toBeTruthy();
    expect(Date.parse(body.expiresAt)).toBeGreaterThan(Date.now());
  });

  test('returns a short-lived signed all.json URL for super-admins only', async () => {
    const env = createTestEnv();
    await setPermission(env, ADMIN_EMAIL, {
      accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
      role: APP_ROLE.ACADEMIC,
    });
    const token = await createSessionToken(env, ADMIN_EMAIL);

    const response = await proxyPathRequest('/user/proxy/all-url', 'GET', env, {
      token,
    });
    const body = (await response.json()) as {
      url: string;
      expiresAt: string;
    };
    const signedUrl = new URL(body.url);

    expect(response.status).toBe(200);
    expect(signedUrl.origin).toBe('https://config.test.scs-pdn.space');
    expect(signedUrl.pathname).toBe('/config/v1/all.json');
    expect(signedUrl.searchParams.get('access_token')).toBeTruthy();
    expect(Date.parse(body.expiresAt)).toBeGreaterThan(Date.now());
  });
});
