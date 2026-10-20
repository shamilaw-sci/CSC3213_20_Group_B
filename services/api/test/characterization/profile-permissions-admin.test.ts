import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';

import {
  ACCESS_LEVEL,
  APP_ROLE,
  type Permission,
} from '@/repositories/permissions.repo';
import type { Env } from '@/types/env';

import { createTestEnv } from 'test/helpers/create-test-env';
import { createTestSessionCookie } from 'test/helpers/create-test-session';
import { invokeWorker } from 'test/helpers/invoke-worker';

const ALLOWED_ORIGIN = 'https://portal.scs-pdn.space';
const ALLOWED_CLIENT_ID = 'portal';
const USER_EMAIL = 'student@pdn.ac.lk';
const ADMIN_EMAIL = 'admin@pdn.ac.lk';
const ORIGINAL_FETCH = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

async function createSessionToken(
  env: Env,
  email: string,
  _claims: Record<string, unknown> = {}
): Promise<string> {
  return createTestSessionCookie(env, email);
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

async function getPermission(env: Env, email: string): Promise<Permission> {
  const stored = await env.PERMISSIONS.get(
    `permissions:${email.toLowerCase()}`
  );
  expect(stored).not.toBeNull();
  return JSON.parse(stored!) as Permission;
}

function apiRequest(
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
    headers.Cookie = options.token;
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

async function createAdminContext(env: Env): Promise<string> {
  await setPermission(env, ADMIN_EMAIL, {
    role: APP_ROLE.USER,
    accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
    name: 'Administrator',
    createdAt: 1000,
  });
  return createSessionToken(env, ADMIN_EMAIL, {
    name: 'Administrator',
    role: APP_ROLE.USER,
    accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
  });
}

describe('/api/me characterization', () => {
  test('rejects a missing session', async () => {
    const response = await apiRequest('/api/me', 'GET', createTestEnv());

    expect(response.status).toBe(401);
    expect(await response.text()).toBe('Unauthorized');
  });

  test('requires a client ID after finding a session cookie', async () => {
    const env = createTestEnv();
    const token = await createSessionToken(env, USER_EMAIL);
    const response = await apiRequest('/api/me', 'GET', env, {
      token,
      clientId: null,
    });

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('Missing X-Client-Id header');
  });

  test('rejects an invalid token', async () => {
    const consoleError = spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await apiRequest('/api/me', 'GET', createTestEnv(), {
        token: '__Secure-scs-auth.session_token=invalid',
      });

      expect(response.status).toBe(401);
      expect(await response.text()).toBe('Invalid token');
      expect(consoleError).toHaveBeenCalledTimes(0);
    } finally {
      consoleError.mockRestore();
    }
  });

  test('returns user not found when the session has no permission record', async () => {
    const env = createTestEnv();
    const token = await createSessionToken(env, USER_EMAIL);
    const response = await apiRequest('/api/me', 'GET', env, { token });

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('User not found');
  });

  test('forbids a blacklisted profile before exposing account data', async () => {
    const env = createTestEnv();
    await setPermission(env, USER_EMAIL, {
      role: APP_ROLE.USER,
      blacklisted: true,
      notifications: { email: true, push: false },
    });
    const token = await createSessionToken(env, USER_EMAIL, {
      name: 'Test Student',
      picture: 'https://images.example/student.png',
    });

    const response = await apiRequest('/api/me', 'GET', env, { token });

    expect(response.status).toBe(403);
    expect(await response.text()).toBe('Forbidden');
  });

  test('forbids profile edits for restricted user-role accounts', async () => {
    const env = createTestEnv();
    await setPermission(env, USER_EMAIL, {
      role: APP_ROLE.USER,
      name: 'Restricted User',
    });
    const token = await createSessionToken(env, USER_EMAIL);

    const response = await apiRequest('/api/me', 'PATCH', env, {
      token,
      body: { name: 'New Name' },
    });

    expect(response.status).toBe(403);
    expect(await response.text()).toBe('Forbidden');
    expect(await getPermission(env, USER_EMAIL)).toEqual({
      role: APP_ROLE.USER,
      name: 'Restricted User',
    });
  });

  test('updates an extensionless manual profile picture after checking image content type', async () => {
    const fetchMock = mock(async () => {
      return new Response(null, {
        status: 200,
        headers: { 'Content-Type': 'image/webp' },
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const env = createTestEnv();
    await setPermission(env, USER_EMAIL, {
      role: APP_ROLE.STUDENT,
      name: 'Test Student',
      picture: 'https://images.example/old.png',
    });
    const token = await createSessionToken(env, USER_EMAIL);

    const response = await apiRequest('/api/me', 'PATCH', env, {
      token,
      body: {
        name: 'Test Student',
        pictureMode: 'manual',
        picture: 'https://images.example/avatar?id=student',
      },
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await getPermission(env, USER_EMAIL)).toMatchObject({
      picture: 'https://images.example/avatar?id=student',
      pictureMode: 'manual',
    });
  });

  test('falls back to GET when HEAD cannot validate an image URL', async () => {
    const fetchMock = mock(
      async (_url: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'HEAD') {
          return new Response(null, { status: 405 });
        }

        return new Response(null, {
          status: 206,
          headers: { 'Content-Type': 'image/jpeg' },
        });
      }
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const env = createTestEnv();
    await setPermission(env, USER_EMAIL, {
      role: APP_ROLE.STUDENT,
      name: 'Test Student',
    });
    const token = await createSessionToken(env, USER_EMAIL);

    const response = await apiRequest('/api/me', 'PATCH', env, {
      token,
      body: {
        name: 'Test Student',
        pictureMode: 'manual',
        picture: 'https://images.example/avatar',
      },
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: 'GET',
      headers: { Range: 'bytes=0-2048' },
    });
  });

  test('rejects manual profile picture URLs that are not png, jpeg, or webp images', async () => {
    const fetchMock = mock(async () => {
      return new Response(null, {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml' },
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const env = createTestEnv();
    await setPermission(env, USER_EMAIL, {
      role: APP_ROLE.STUDENT,
      name: 'Test Student',
    });
    const token = await createSessionToken(env, USER_EMAIL);

    const response = await apiRequest('/api/me', 'PATCH', env, {
      token,
      body: {
        name: 'Test Student',
        pictureMode: 'manual',
        picture: 'https://images.example/avatar.png',
      },
    });

    expect(response.status).toBe(400);
    expect((await response.json()) as unknown).toEqual({
      error: 'Picture URL must point to a PNG, JPEG, or WebP image',
    });
  });
});

describe('/api/me/notifications characterization', () => {
  test('forbids a blacklisted user', async () => {
    const env = createTestEnv();
    await setPermission(env, USER_EMAIL, {
      role: APP_ROLE.USER,
      blacklisted: true,
    });
    const token = await createSessionToken(env, USER_EMAIL);

    const response = await apiRequest('/api/me/notifications', 'PATCH', env, {
      token,
      body: { notifications: { email: true, push: true } },
    });

    expect(response.status).toBe(403);
    expect(await response.text()).toBe('Forbidden');
  });

  test('forbids notification changes for restricted user-role accounts', async () => {
    const env = createTestEnv();
    await setPermission(env, USER_EMAIL, {
      role: APP_ROLE.USER,
      notifications: { email: false, push: false },
    });
    const token = await createSessionToken(env, USER_EMAIL);

    const response = await apiRequest('/api/me/notifications', 'PATCH', env, {
      token,
      body: { notifications: { email: true, push: true } },
    });

    expect(response.status).toBe(403);
    expect(await response.text()).toBe('Forbidden');
    expect(await getPermission(env, USER_EMAIL)).toEqual({
      role: APP_ROLE.USER,
      notifications: { email: false, push: false },
    });
  });

  test('updates supplied notification fields and preserves omitted values', async () => {
    const env = createTestEnv();
    await setPermission(env, USER_EMAIL, {
      role: APP_ROLE.STUDENT,
      name: 'Test Student',
      notifications: { email: false, push: true },
    });
    const token = await createSessionToken(env, USER_EMAIL);

    const response = await apiRequest('/api/me/notifications', 'PATCH', env, {
      token,
      body: { notifications: { email: true } },
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Permission updated');
    expect(await getPermission(env, USER_EMAIL)).toEqual({
      role: APP_ROLE.STUDENT,
      accessLevel: ACCESS_LEVEL.NONE,
      name: 'Test Student',
      notifications: { email: true, push: true },
    });
  });
});

describe('/api/admin/users characterization', () => {
  test('forbids an authenticated non-admin', async () => {
    const env = createTestEnv();
    await setPermission(env, USER_EMAIL, {
      role: APP_ROLE.USER,
      name: 'Test Student',
    });
    const token = await createSessionToken(env, USER_EMAIL);

    const response = await apiRequest('/api/admin/users', 'GET', env, {
      token,
    });

    expect(response.status).toBe(403);
    expect(await response.text()).toBe('Forbidden');
  });

  test('forbids a blacklisted super-admin', async () => {
    const env = createTestEnv();
    await setPermission(env, ADMIN_EMAIL, {
      role: APP_ROLE.USER,
      accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
      blacklisted: true,
    });
    const token = await createSessionToken(env, ADMIN_EMAIL);

    const response = await apiRequest('/api/admin/users', 'GET', env, {
      token,
    });

    expect(response.status).toBe(403);
    expect(await response.text()).toBe('Forbidden');
  });

  test('returns the current projected user list to a super-admin', async () => {
    const env = createTestEnv();
    const token = await createAdminContext(env);
    await setPermission(env, USER_EMAIL, {
      name: 'Test Student',
      picture: 'https://images.example/student.png',
      blacklisted: true,
      createdAt: 2000,
      notifications: { email: true },
    });

    const response = await apiRequest('/api/admin/users', 'GET', env, {
      token,
    });

    expect(response.status).toBe(200);
    expect((await response.json()) as unknown).toEqual([
      {
        id: ADMIN_EMAIL,
        email: ADMIN_EMAIL,
        name: 'Administrator',
        picture: '',
        role: APP_ROLE.USER,
        accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
        blacklisted: false,
        createdAt: 1000,
      },
      {
        id: USER_EMAIL,
        email: USER_EMAIL,
        name: 'Test Student',
        picture: 'https://images.example/student.png',
        role: APP_ROLE.STUDENT,
        accessLevel: ACCESS_LEVEL.NONE,
        blacklisted: true,
        createdAt: 2000,
      },
    ]);
  });
});

describe('/api/admin/users/:email characterization', () => {
  test('returns user not found for an unknown target', async () => {
    const env = createTestEnv();
    const token = await createAdminContext(env);

    const response = await apiRequest(
      `/api/admin/users/${encodeURIComponent(USER_EMAIL)}`,
      'GET',
      env,
      { token }
    );

    expect(response.status).toBe(404);
    expect((await response.json()) as unknown).toEqual({
      error: 'User not found',
    });
  });

  test('returns the complete stored permission to a super-admin', async () => {
    const env = createTestEnv();
    const token = await createAdminContext(env);
    const targetPermission: Permission = {
      name: 'Test Student',
      role: APP_ROLE.USER,
      accessLevel: ACCESS_LEVEL.NONE,
      include: { portal: 'EDITOR' },
      notifications: { email: true, push: false },
      createdAt: 2000,
    };
    await setPermission(env, USER_EMAIL, targetPermission);

    const response = await apiRequest(
      `/api/admin/users/${encodeURIComponent(USER_EMAIL)}`,
      'GET',
      env,
      { token }
    );

    expect(response.status).toBe(200);
    expect((await response.json()) as unknown).toEqual({
      ...targetPermission,
      googleOAuth: false,
      githubOAuth: false,
      githubUserID: null,
    });
  });

  test('shallow-merges a permission patch and returns the stored result', async () => {
    const env = createTestEnv();
    const token = await createAdminContext(env);
    await setPermission(env, USER_EMAIL, {
      name: 'Test Student',
      include: { portal: 'VIEWER' },
      notifications: { email: false, push: true },
      createdAt: 2000,
    });

    const response = await apiRequest(
      `/api/admin/users/${encodeURIComponent(USER_EMAIL)}`,
      'PATCH',
      env,
      {
        token,
        body: {
          blacklisted: true,
          notifications: { email: true },
        },
      }
    );

    const expected: Permission = {
      role: APP_ROLE.STUDENT,
      accessLevel: ACCESS_LEVEL.NONE,
      name: 'Test Student',
      include: { portal: 'VIEWER' },
      notifications: { email: true },
      createdAt: 2000,
      blacklisted: true,
    };

    expect(response.status).toBe(200);
    expect((await response.json()) as unknown).toEqual(expected);
    expect(await getPermission(env, USER_EMAIL)).toEqual(expected);
  });

  test('updates roles directly from the role field', async () => {
    const env = createTestEnv();
    const token = await createAdminContext(env);
    await setPermission(env, USER_EMAIL, {
      role: APP_ROLE.USER,
      accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
      name: 'Target Admin',
    });

    const response = await apiRequest(
      `/api/admin/users/${encodeURIComponent(USER_EMAIL)}`,
      'PATCH',
      env,
      {
        token,
        body: {
          role: APP_ROLE.USER,
        },
      }
    );

    expect(response.status).toBe(200);
    expect(await getPermission(env, USER_EMAIL)).toEqual({
      role: APP_ROLE.USER,
      accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
      name: 'Target Admin',
    });
  });

  test('prevents a super-admin from downgrading themselves', async () => {
    const env = createTestEnv();
    const token = await createAdminContext(env);

    const response = await apiRequest(
      `/api/admin/users/${encodeURIComponent(ADMIN_EMAIL)}`,
      'PATCH',
      env,
      {
        token,
        body: {
          accessLevel: ACCESS_LEVEL.ADMIN,
        },
      }
    );

    expect(response.status).toBe(409);
    expect((await response.json()) as unknown).toEqual({
      error: 'Cannot remove your own super-admin role',
    });
    expect(await getPermission(env, ADMIN_EMAIL)).toMatchObject({
      role: APP_ROLE.USER,
      accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
    });
  });
});

describe('/api/admin/actions characterization', () => {
  test('lists schema-described actions for a super-admin', async () => {
    const env = createTestEnv();
    const token = await createAdminContext(env);

    const response = await apiRequest('/api/admin/actions', 'GET', env, {
      token,
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      schemaVersion: number;
      actions: Array<{ id: string; requestSchema: unknown }>;
    };
    expect(body.schemaVersion).toBe(1);
    expect(body.actions.map((action) => action.id)).toEqual([
      'migrate-legacy-auth',
    ]);
    expect(body.actions[0]?.requestSchema).toBeDefined();
  });

  test('requires confirmation and runs the legacy auth migration', async () => {
    const env = createTestEnv();
    const token = await createAdminContext(env);
    await env.PERMISSIONS.put(
      `permissions:${USER_EMAIL}`,
      JSON.stringify({
        role: APP_ROLE.STUDENT,
        name: 'Test Student',
        githubUserID: 12345,
      })
    );

    const rejected = await apiRequest(
      '/api/admin/actions/migrate-legacy-auth',
      'POST',
      env,
      { token, body: { confirmation: 'migrate' } }
    );
    expect(rejected.status).toBe(400);

    const response = await apiRequest(
      '/api/admin/actions/migrate-legacy-auth',
      'POST',
      env,
      {
        token,
        body: {
          confirmation:
            'Migrate legacy GitHub identities and passkeys into Better Auth.',
        },
      }
    );

    expect(response.status).toBe(200);
    expect((await response.json()) as unknown).toMatchObject({
      scanned: 2,
      usersCreated: 1,
      githubAccountsCreated: 1,
      permissionsCleaned: 1,
      conflicts: [],
    });
    expect(
      await env.AUTH_DB.prepare(
        'SELECT accountId FROM account WHERE providerId = ?'
      )
        .bind('github')
        .first<{ accountId: string }>()
    ).toEqual({ accountId: '12345' });
    expect(await getPermission(env, USER_EMAIL)).toEqual({
      role: APP_ROLE.STUDENT,
      accessLevel: ACCESS_LEVEL.NONE,
      name: 'Test Student',
    });
  });

  test('returns not found for unknown admin actions', async () => {
    const env = createTestEnv();
    const token = await createAdminContext(env);

    const response = await apiRequest(
      '/api/admin/actions/unknown-action',
      'POST',
      env,
      {
        token,
        body: { mode: 'apply' },
      }
    );

    expect(response.status).toBe(404);
    expect((await response.json()) as unknown).toEqual({
      error: 'Action not found',
    });
  });
});
