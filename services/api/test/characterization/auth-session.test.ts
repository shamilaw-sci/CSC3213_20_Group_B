import { afterEach, describe, expect, mock, test } from 'bun:test';
import { jwtVerify } from 'jose';

import type { Env } from '@/types/env';
import { ACCESS_LEVEL, APP_ROLE } from '@/repositories/permissions.repo';
import { issueSessionJwt } from '@/services/auth.service';

import { createTestEnv } from 'test/helpers/create-test-env';
import { invokeWorker } from 'test/helpers/invoke-worker';

const ALLOWED_ORIGIN = 'https://portal.scs-pdn.space';
const ALLOWED_CLIENT_ID = 'portal';
const ALLOWED_EMAIL = 'student@pdn.ac.lk';
const ORIGINAL_FETCH = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

function jsonRequest(
  path: string,
  body: unknown,
  env: Env,
  headers: Record<string, string> = {}
): Promise<Response> {
  return invokeWorker(
    path,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: ALLOWED_ORIGIN,
        ...headers,
      },
      body: JSON.stringify(body),
    },
    env
  );
}

function authenticatedJsonRequest(
  path: string,
  body: unknown,
  env: Env
): Promise<Response> {
  return jsonRequest(path, body, env, {
    'X-Client-Id': ALLOWED_CLIENT_ID,
  });
}

async function signup(env: Env, email = ALLOWED_EMAIL): Promise<string> {
  const response = await authenticatedJsonRequest(
    '/auth/signup',
    { email },
    env
  );
  expect(response.status).toBe(200);

  const body = (await response.json()) as { token: string };
  return body.token;
}

describe('/auth/signup characterization', () => {
  test('requires a client context', async () => {
    const response = await jsonRequest(
      '/auth/signup',
      { email: ALLOWED_EMAIL },
      createTestEnv()
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('Missing client context');
  });

  test('rejects an invalid client context', async () => {
    const response = await jsonRequest(
      '/auth/signup',
      { email: ALLOWED_EMAIL },
      createTestEnv(),
      { 'X-Client-Id': 'unknown-client' }
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe('Unauthorized client_id');
  });

  test('requires an email', async () => {
    const response = await authenticatedJsonRequest(
      '/auth/signup',
      {},
      createTestEnv()
    );

    expect(response.status).toBe(400);
    expect((await response.json()) as unknown).toEqual({
      error: 'Email required',
    });
  });

  test('rejects a disallowed email domain', async () => {
    const response = await authenticatedJsonRequest(
      '/auth/signup',
      { email: 'student@example.com' },
      createTestEnv()
    );

    expect(response.status).toBe(400);
    expect((await response.json()) as unknown).toEqual({
      error: 'Unauthorized email domain',
      message:
        'Access is restricted to University of Peradeniya Google Workspace accounts. Please sign in using your official @pdn.ac.lk or @sci.pdn.ac.lk email address. Personal Gmail or other email accounts are not permitted.',
      allowed_domains: ['pdn.ac.lk', 'sci.pdn.ac.lk'],
    });
  });

  test('creates a permission record and returns a verifiable session token', async () => {
    const env = createTestEnv();
    const response = await authenticatedJsonRequest(
      '/auth/signup',
      {
        email: ALLOWED_EMAIL,
        name: '  Test Student  ',
        picture: 'https://images.example/student.png',
      },
      env
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      ALLOWED_ORIGIN
    );

    const body = (await response.json()) as { token: string };
    const { payload } = await jwtVerify(
      body.token,
      new TextEncoder().encode(env.JWT_SECRET),
      {
        issuer: env.JWT_ISSUER,
        audience: ALLOWED_CLIENT_ID,
      }
    );

    expect(payload.sub).toBe(ALLOWED_EMAIL);
    expect(payload.email).toBe(ALLOWED_EMAIL);
    expect(payload.name).toBe('Test Student');
    expect(payload.picture).toBe('https://images.example/student.png');
    expect(payload.role).toBe(APP_ROLE.ACADEMIC);
    expect(payload.accessLevel).toBe(ACCESS_LEVEL.NONE);
    expect(typeof payload.jti).toBe('string');

    const stored = await env.PERMISSIONS.get(`permissions:${ALLOWED_EMAIL}`);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toMatchObject({
      role: APP_ROLE.ACADEMIC,
      accessLevel: ACCESS_LEVEL.NONE,
      name: 'Test Student',
      picture: 'https://images.example/student.png',
    });
  });

  test('defaults student-pattern usernames to the student role', async () => {
    const env = createTestEnv();
    const email = 's24sp001@pdn.ac.lk';

    const token = await signup(env, email);
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(env.JWT_SECRET),
      {
        issuer: env.JWT_ISSUER,
        audience: ALLOWED_CLIENT_ID,
      }
    );
    expect(payload.role).toBe(APP_ROLE.STUDENT);
    expect(payload.accessLevel).toBe(ACCESS_LEVEL.NONE);

    const stored = await env.PERMISSIONS.get(`permissions:${email}`);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toMatchObject({
      role: APP_ROLE.STUDENT,
      accessLevel: ACCESS_LEVEL.NONE,
    });
  });

  test('login refreshes picture without overwriting the stored name', async () => {
    const env = createTestEnv();
    await env.PERMISSIONS.put(
      `permissions:${ALLOWED_EMAIL}`,
      JSON.stringify({
        role: APP_ROLE.ACADEMIC,
        name: 'Stored Name',
        picture: 'https://images.example/old.png',
      })
    );

    const response = await issueSessionJwt(
      new Request('https://api.scs-pdn.space/auth/google/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: ALLOWED_ORIGIN,
        },
        body: JSON.stringify({
          email: ALLOWED_EMAIL,
          name: 'Provider Name',
          picture: 'https://images.example/new.png',
        }),
      }),
      env,
      ALLOWED_CLIENT_ID
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { token: string };
    const { payload } = await jwtVerify(
      body.token,
      new TextEncoder().encode(env.JWT_SECRET),
      {
        issuer: env.JWT_ISSUER,
        audience: ALLOWED_CLIENT_ID,
      }
    );

    expect(payload.name).toBe('Stored Name');
    expect(payload.picture).toBe('https://images.example/new.png');
    expect(payload.role).toBe(APP_ROLE.ACADEMIC);
    expect(payload.accessLevel).toBe(ACCESS_LEVEL.NONE);

    const stored = await env.PERMISSIONS.get(`permissions:${ALLOWED_EMAIL}`);
    expect(JSON.parse(stored!)).toEqual({
      role: APP_ROLE.ACADEMIC,
      accessLevel: ACCESS_LEVEL.NONE,
      name: 'Stored Name',
      picture: 'https://images.example/new.png',
    });
  });

  test('provider login respects manual profile picture mode', async () => {
    const env = createTestEnv();
    await env.PERMISSIONS.put(
      `permissions:${ALLOWED_EMAIL}`,
      JSON.stringify({
        role: APP_ROLE.ACADEMIC,
        name: 'Stored Name',
        picture: 'https://images.example/manual.png',
        pictureMode: 'manual',
      })
    );

    const response = await issueSessionJwt(
      new Request('https://api.scs-pdn.space/auth/google/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: ALLOWED_ORIGIN,
        },
        body: JSON.stringify({
          email: ALLOWED_EMAIL,
          name: 'Provider Name',
          picture: 'https://images.example/google.png',
        }),
      }),
      env,
      ALLOWED_CLIENT_ID,
      'google'
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { token: string };
    const { payload } = await jwtVerify(
      body.token,
      new TextEncoder().encode(env.JWT_SECRET),
      {
        issuer: env.JWT_ISSUER,
        audience: ALLOWED_CLIENT_ID,
      }
    );

    expect(payload.picture).toBe('https://images.example/manual.png');

    const stored = await env.PERMISSIONS.get(`permissions:${ALLOWED_EMAIL}`);
    expect(JSON.parse(stored!)).toEqual({
      role: APP_ROLE.ACADEMIC,
      accessLevel: ACCESS_LEVEL.NONE,
      name: 'Stored Name',
      picture: 'https://images.example/manual.png',
      pictureMode: 'manual',
    });
  });
});

describe('/auth/magic-code characterization', () => {
  test('requires an email', async () => {
    const response = await authenticatedJsonRequest(
      '/auth/magic-code',
      {},
      createTestEnv()
    );

    expect(response.status).toBe(400);
    expect((await response.json()) as unknown).toEqual({
      error: 'Email required',
    });
  });

  test('rejects a disallowed email domain with its current payload', async () => {
    const response = await authenticatedJsonRequest(
      '/auth/magic-code',
      { email: 'student@example.com' },
      createTestEnv()
    );

    expect(response.status).toBe(400);
    expect((await response.json()) as unknown).toEqual({
      error: 'Unauthorized email domain',
      message: 'Use your @pdn.ac.lk or @sci.pdn.ac.lk email.',
    });
  });

  test('stores a six-digit code and sends the current mail payload', async () => {
    const env = createTestEnv();
    const fetchMock = mock(async (..._args: Parameters<typeof fetch>) =>
      Response.json({ ok: true })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await authenticatedJsonRequest(
      '/auth/magic-code',
      { email: ALLOWED_EMAIL },
      env
    );

    expect(response.status).toBe(200);
    expect((await response.json()) as unknown).toEqual({
      message: 'Magic code sent',
      expiresIn: 300,
    });

    const storedCodes = await env.MAGIC_CODES.list();
    expect(storedCodes.keys).toHaveLength(1);
    const code = storedCodes.keys[0].name;
    expect(code).toMatch(/^\d{6}$/);
    expect(await env.MAGIC_CODES.get(code)).toBe(ALLOWED_EMAIL);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${env.MAILER_API_URL}/send`);
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.MAILER_API_KEY}`,
      },
    });

    const mailBody = JSON.parse(String(init?.body));
    expect(mailBody).toMatchObject({
      to: ALLOWED_EMAIL,
      subject: 'SCS Portal - Sign In Code',
    });
    expect(mailBody.html).toContain(code);
    expect(mailBody.text).toContain(code);
  });
});

describe('/auth/magic-code/verify characterization', () => {
  test('rejects a missing code', async () => {
    const response = await authenticatedJsonRequest(
      '/auth/magic-code/verify',
      { email: ALLOWED_EMAIL },
      createTestEnv()
    );

    expect(response.status).toBe(400);
    expect((await response.json()) as unknown).toEqual({
      error: 'magic_code_missing',
    });
  });

  test('rejects an invalid code', async () => {
    const response = await authenticatedJsonRequest(
      '/auth/magic-code/verify',
      { email: ALLOWED_EMAIL, code: '000000' },
      createTestEnv()
    );

    expect(response.status).toBe(401);
    expect((await response.json()) as unknown).toEqual({
      error: 'magic_code_invalid',
    });
  });

  test('consumes the code, creates the user, and returns JSON with a session cookie', async () => {
    const env = createTestEnv();
    const code = '123456';
    await env.MAGIC_CODES.put(code, ALLOWED_EMAIL);

    const response = await authenticatedJsonRequest(
      '/auth/magic-code/verify',
      { email: ALLOWED_EMAIL, code },
      env
    );

    expect(response.status).toBe(200);
    expect((await response.json()) as unknown).toEqual({
      verified: true,
      redirectTo: 'https://portal.scs-pdn.space/dashboard',
    });

    const sessionCookie = response.headers
      .getSetCookie()
      .find((cookie) => cookie.startsWith('session='));
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('Secure');
    expect(sessionCookie).toContain('SameSite=Lax');
    expect(sessionCookie).toContain('Domain=.scs-pdn.space');
    expect(sessionCookie).toContain('Path=/');
    expect(sessionCookie).toContain('Max-Age=18000');

    expect(await env.MAGIC_CODES.get(code)).toBeNull();
    expect(
      await env.PERMISSIONS.get(`permissions:${ALLOWED_EMAIL}`)
    ).not.toBeNull();
  });
});

describe('/auth/verify and /auth/logout characterization', () => {
  test('verify rejects a missing token', async () => {
    const response = await invokeWorker(
      '/auth/verify',
      {
        method: 'GET',
        headers: {
          Origin: ALLOWED_ORIGIN,
          'X-Client-Id': ALLOWED_CLIENT_ID,
        },
      },
      createTestEnv()
    );

    expect(response.status).toBe(401);
    expect(await response.text()).toBe('Missing token');
  });

  test('verify rejects an invalid token', async () => {
    const response = await invokeWorker(
      '/auth/verify',
      {
        method: 'GET',
        headers: {
          Cookie: 'session=not-a-jwt',
          Origin: ALLOWED_ORIGIN,
          'X-Client-Id': ALLOWED_CLIENT_ID,
        },
      },
      createTestEnv()
    );

    expect(response.status).toBe(401);
    expect(await response.text()).toBe('Invalid token');
  });

  test('verify returns the current valid-session payload', async () => {
    const env = createTestEnv();
    const token = await signup(env);

    const response = await invokeWorker(
      '/auth/verify',
      {
        method: 'GET',
        headers: {
          Cookie: `session=${token}`,
          Origin: ALLOWED_ORIGIN,
          'X-Client-Id': ALLOWED_CLIENT_ID,
        },
      },
      env
    );

    expect(response.status).toBe(200);
    expect((await response.json()) as unknown).toEqual({
      valid: true,
      email: ALLOWED_EMAIL,
      role: APP_ROLE.ACADEMIC,
      accessLevel: ACCESS_LEVEL.NONE,
    });
  });

  test('logout revokes the session and clears both auth cookies', async () => {
    const env = createTestEnv();
    const token = await signup(env);
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(env.JWT_SECRET),
      { issuer: env.JWT_ISSUER }
    );

    const response = await invokeWorker(
      '/auth/logout',
      {
        method: 'GET',
        headers: {
          Cookie: `session=${token}`,
          Origin: ALLOWED_ORIGIN,
        },
      },
      env
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
    expect(response.headers.getSetCookie()).toEqual([
      'session=; HttpOnly; Secure; SameSite=Lax; Domain=.scs-pdn.space; Path=/; Max-Age=0',
      'oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
    ]);
    expect(await env.TOKEN_BLACKLIST.get(String(payload.jti))).toBe('revoked');

    const verifyResponse = await invokeWorker(
      '/auth/verify',
      {
        method: 'GET',
        headers: {
          Cookie: `session=${token}`,
          Origin: ALLOWED_ORIGIN,
          'X-Client-Id': ALLOWED_CLIENT_ID,
        },
      },
      env
    );

    expect(verifyResponse.status).toBe(401);
    expect(await verifyResponse.text()).toBe('Token revoked');
  });

  test('logout remains a best-effort success for an invalid token', async () => {
    const response = await invokeWorker('/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: 'session=not-a-jwt',
        Origin: ALLOWED_ORIGIN,
      },
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
    expect(response.headers.getSetCookie()).toEqual([]);
  });
});
