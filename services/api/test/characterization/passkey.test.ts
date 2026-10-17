import { describe, expect, test } from 'bun:test';
import { jwtVerify, SignJWT } from 'jose';

import {
  ACCESS_LEVEL,
  APP_ROLE,
  type PasskeyCredential,
  type Permission,
} from '@/repositories/permissions.repo';
import type { Env } from '@/types/env';

import { createTestEnv } from 'test/helpers/create-test-env';
import { invokeWorker } from 'test/helpers/invoke-worker';

const ALLOWED_ORIGIN = 'https://portal.scs-pdn.space';
const FORBIDDEN_ORIGIN = 'https://untrusted.example';
const ALLOWED_CLIENT_ID = 'portal';
const RP_ID = 'scs-pdn.space';
const USER_EMAIL = 'student@pdn.ac.lk';
const OTHER_EMAIL = 'other@pdn.ac.lk';
const ADMIN_EMAIL = 'admin@pdn.ac.lk';

type ChallengeType = 'passkey_registration' | 'passkey_authentication';

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

async function createChallengeToken(
  env: Env,
  type: ChallengeType,
  overrides: Record<string, unknown> = {}
): Promise<string> {
  return new SignJWT({
    type,
    challenge: 'test-challenge',
    clientId: ALLOWED_CLIENT_ID,
    email: USER_EMAIL,
    origin: ALLOWED_ORIGIN,
    rpId: RP_ID,
    ...overrides,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
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

async function getPermission(env: Env, email: string): Promise<Permission> {
  const stored = await env.PERMISSIONS.get(
    `permissions:${email.toLowerCase()}`
  );
  expect(stored).not.toBeNull();
  return JSON.parse(stored!) as Permission;
}

function createCredential(
  id: string,
  name: string,
  overrides: Partial<PasskeyCredential> = {}
): PasskeyCredential {
  return {
    id,
    publicKey: 'AQID',
    counter: 0,
    transports: ['internal'],
    backedUp: false,
    deviceType: 'singleDevice',
    rpId: RP_ID,
    createdAt: 1000,
    name,
    ...overrides,
  };
}

function passkeyRequest(
  path: string,
  method: string,
  env: Env,
  options: {
    token?: string;
    challenge?: string;
    clientId?: string | null;
    origin?: string;
    body?: unknown;
  } = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    Origin: options.origin ?? ALLOWED_ORIGIN,
  };

  if (options.clientId !== null) {
    headers['X-Client-Id'] = options.clientId ?? ALLOWED_CLIENT_ID;
  }

  const cookies: string[] = [];
  if (options.token) cookies.push(`session=${options.token}`);
  if (options.challenge) {
    cookies.push(`passkey_challenge=${options.challenge}`);
  }
  if (cookies.length > 0) {
    headers.Cookie = cookies.join('; ');
  }

  let body: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  return invokeWorker(path, { method, headers, body }, env);
}

function expectJsonError(body: unknown, error: string): void {
  expect(body).toEqual({ error });
}

function getChallengeCookie(response: Response): string {
  const cookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith('passkey_challenge='));
  expect(cookie).toBeDefined();

  const match = /^passkey_challenge=([^;]+);/.exec(cookie!);
  expect(match).not.toBeNull();
  return match![1];
}

describe('passkey context characterization', () => {
  test('requires a client context before other registration checks', async () => {
    const response = await passkeyRequest(
      '/auth/passkey/register/options',
      'POST',
      createTestEnv(),
      { clientId: null, body: {} }
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('Missing client context');
  });

  test('rejects a forbidden origin before checking the session', async () => {
    const response = await passkeyRequest(
      '/auth/passkey/register/options',
      'POST',
      createTestEnv(),
      { origin: FORBIDDEN_ORIGIN, body: {} }
    );

    expect(response.status).toBe(403);
    expectJsonError((await response.json()) as unknown, 'Forbidden origin');
  });

  test('rejects a missing session', async () => {
    const response = await passkeyRequest(
      '/auth/passkey/register/options',
      'POST',
      createTestEnv(),
      { body: {} }
    );

    expect(response.status).toBe(401);
    expectJsonError((await response.json()) as unknown, 'Missing session');
  });

  test('rejects an invalid session', async () => {
    const response = await passkeyRequest(
      '/auth/passkey/register/options',
      'POST',
      createTestEnv(),
      { token: 'not-a-jwt', body: {} }
    );

    expect(response.status).toBe(401);
    expectJsonError((await response.json()) as unknown, 'Invalid session');
  });
});

describe('/auth/passkey/register/options characterization', () => {
  test('returns registration options and a signed challenge cookie', async () => {
    const env = createTestEnv();
    await setPermission(env, USER_EMAIL, { name: 'Stored Name' });
    const token = await createSessionToken(env, USER_EMAIL);

    const response = await passkeyRequest(
      '/auth/passkey/register/options',
      'POST',
      env,
      { token, body: { name: '  Laptop  ' } }
    );
    const body = (await response.json()) as {
      challenge: string;
      rp: { id: string; name: string };
      user: { name: string; displayName: string };
      excludeCredentials: unknown[];
      attestation: string;
      authenticatorSelection: {
        residentKey: string;
        userVerification: string;
      };
    };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      rp: { id: RP_ID, name: 'SCS Portal' },
      user: { name: USER_EMAIL, displayName: 'Laptop' },
      excludeCredentials: [],
      attestation: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
      },
    });
    expect(typeof body.challenge).toBe('string');

    const challengeToken = getChallengeCookie(response);
    expect(response.headers.getSetCookie()).toEqual([
      `passkey_challenge=${challengeToken}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=300`,
    ]);

    const { payload } = await jwtVerify(
      challengeToken,
      new TextEncoder().encode(env.JWT_SECRET)
    );
    expect(payload).toMatchObject({
      type: 'passkey_registration',
      challenge: body.challenge,
      clientId: ALLOWED_CLIENT_ID,
      email: USER_EMAIL,
      origin: ALLOWED_ORIGIN,
      rpId: RP_ID,
      passkeyName: 'Laptop',
    });
  });
});

describe('/auth/passkey/register/verify characterization', () => {
  test('rejects a missing challenge cookie', async () => {
    const response = await passkeyRequest(
      '/auth/passkey/register/verify',
      'POST',
      createTestEnv(),
      { body: {} }
    );

    expect(response.status).toBe(401);
    expectJsonError(
      (await response.json()) as unknown,
      'Missing passkey challenge'
    );
  });

  test('rejects a malformed challenge cookie', async () => {
    const response = await passkeyRequest(
      '/auth/passkey/register/verify',
      'POST',
      createTestEnv(),
      { challenge: 'not-a-jwt', body: {} }
    );

    expect(response.status).toBe(401);
    expectJsonError(
      (await response.json()) as unknown,
      'Invalid or expired passkey challenge'
    );
  });

  test('rejects a signed challenge with the wrong type', async () => {
    const env = createTestEnv();
    const challenge = await createChallengeToken(env, 'passkey_authentication');

    const response = await passkeyRequest(
      '/auth/passkey/register/verify',
      'POST',
      env,
      { challenge, body: {} }
    );

    expect(response.status).toBe(401);
    expectJsonError(
      (await response.json()) as unknown,
      'Invalid passkey challenge'
    );
  });

  test('requires a credential response after accepting the challenge', async () => {
    const env = createTestEnv();
    const challenge = await createChallengeToken(env, 'passkey_registration');

    const response = await passkeyRequest(
      '/auth/passkey/register/verify',
      'POST',
      env,
      { challenge, body: {} }
    );

    expect(response.status).toBe(400);
    expectJsonError(
      (await response.json()) as unknown,
      'Passkey response required'
    );
  });
});

describe('/auth/passkey/login characterization', () => {
  test('returns discoverable login options and an email-less challenge', async () => {
    const env = createTestEnv();

    const response = await passkeyRequest(
      '/auth/passkey/login/options',
      'POST',
      env,
      { body: {} }
    );
    const body = (await response.json()) as {
      challenge: string;
      rpId: string;
      userVerification: string;
      allowCredentials?: unknown[];
    };

    expect(response.status).toBe(200);
    expect(body.rpId).toBe(RP_ID);
    expect(body.userVerification).toBe('required');
    expect(body.allowCredentials).toBeUndefined();

    const challengeToken = getChallengeCookie(response);
    const { payload } = await jwtVerify(
      challengeToken,
      new TextEncoder().encode(env.JWT_SECRET)
    );
    expect(payload).toMatchObject({
      type: 'passkey_authentication',
      challenge: body.challenge,
      clientId: ALLOWED_CLIENT_ID,
      email: '',
      origin: ALLOWED_ORIGIN,
      rpId: RP_ID,
    });
  });

  test('returns passkey-not-registered for an unknown email', async () => {
    const response = await passkeyRequest(
      '/auth/passkey/login/options',
      'POST',
      createTestEnv(),
      { body: { email: USER_EMAIL } }
    );

    expect(response.status).toBe(403);
    expectJsonError(
      (await response.json()) as unknown,
      'Passkey is not registered'
    );
  });

  test('returns allowCredentials for an email-specific login', async () => {
    const env = createTestEnv();
    const credential = createCredential('credential-one', 'Laptop');
    await setPermission(env, USER_EMAIL, { passkeys: [credential] });

    const response = await passkeyRequest(
      '/auth/passkey/login/options',
      'POST',
      env,
      { body: { email: USER_EMAIL } }
    );
    const body = (await response.json()) as {
      allowCredentials: {
        id: string;
        transports?: string[];
        type: string;
      }[];
    };

    expect(response.status).toBe(200);
    expect(body.allowCredentials).toEqual([
      {
        id: credential.id,
        transports: ['internal'],
        type: 'public-key',
      },
    ]);
    expect(getChallengeCookie(response)).toBeTruthy();
  });

  test('login verification requires a response after accepting its challenge', async () => {
    const env = createTestEnv();
    const challenge = await createChallengeToken(env, 'passkey_authentication');

    const response = await passkeyRequest(
      '/auth/passkey/login/verify',
      'POST',
      env,
      { challenge, body: {} }
    );

    expect(response.status).toBe(400);
    expectJsonError(
      (await response.json()) as unknown,
      'Passkey response required'
    );
  });
});

describe('/auth/passkey/credentials characterization', () => {
  test('lists only credentials for the request origin RP', async () => {
    const env = createTestEnv();
    const matching = createCredential('credential-one', 'Laptop');
    const otherRp = createCredential('credential-two', 'Other Portal', {
      rpId: 'portal.scs.pdn.ac.lk',
    });
    await setPermission(env, USER_EMAIL, {
      passkeys: [matching, otherRp],
    });
    const token = await createSessionToken(env, USER_EMAIL);

    const response = await passkeyRequest(
      '/auth/passkey/credentials',
      'GET',
      env,
      { token }
    );

    expect(response.status).toBe(200);
    expect((await response.json()) as unknown).toEqual({
      credentials: [matching],
    });
  });

  test('GET on a credential path reaches rename validation', async () => {
    const env = createTestEnv();
    await setPermission(env, USER_EMAIL, {
      passkeys: [createCredential('credential-one', 'Laptop')],
    });
    const token = await createSessionToken(env, USER_EMAIL);

    const response = await passkeyRequest(
      '/auth/passkey/credentials/credential-one',
      'GET',
      env,
      { token }
    );

    expect(response.status).toBe(400);
    expectJsonError((await response.json()) as unknown, 'Missing name');
  });

  test('requires a string name for credential rename', async () => {
    const env = createTestEnv();
    await setPermission(env, USER_EMAIL, {
      passkeys: [createCredential('credential-one', 'Laptop')],
    });
    const token = await createSessionToken(env, USER_EMAIL);

    const response = await passkeyRequest(
      '/auth/passkey/credentials/credential-one',
      'PATCH',
      env,
      { token, body: { name: 123 } }
    );

    expect(response.status).toBe(400);
    expectJsonError((await response.json()) as unknown, 'Missing name');
  });

  test('rejects a duplicate credential name', async () => {
    const env = createTestEnv();
    await setPermission(env, USER_EMAIL, {
      passkeys: [
        createCredential('credential-one', 'Laptop'),
        createCredential('credential-two', 'Phone'),
      ],
    });
    const token = await createSessionToken(env, USER_EMAIL);

    const response = await passkeyRequest(
      '/auth/passkey/credentials/credential-two',
      'PATCH',
      env,
      { token, body: { name: 'Laptop' } }
    );

    expect(response.status).toBe(409);
    expect((await response.json()) as unknown).toEqual({
      code: 'passkey_name_conflict',
      message: 'Passkey name already in use',
    });
  });

  test('trims and stores a credential rename', async () => {
    const env = createTestEnv();
    await setPermission(env, USER_EMAIL, {
      passkeys: [createCredential('credential-one', 'Laptop')],
    });
    const token = await createSessionToken(env, USER_EMAIL);

    const response = await passkeyRequest(
      '/auth/passkey/credentials/credential-one',
      'PATCH',
      env,
      { token, body: { name: '  Security Key  ' } }
    );

    expect(response.status).toBe(200);
    expect((await response.json()) as unknown).toEqual({ success: true });
    expect((await getPermission(env, USER_EMAIL)).passkeys?.[0].name).toBe(
      'Security Key'
    );
  });

  test('deletes a credential and preserves the others', async () => {
    const env = createTestEnv();
    const removed = createCredential('credential-one', 'Laptop');
    const retained = createCredential('credential-two', 'Phone');
    await setPermission(env, USER_EMAIL, {
      passkeys: [removed, retained],
    });
    const token = await createSessionToken(env, USER_EMAIL);

    const response = await passkeyRequest(
      '/auth/passkey/credentials/credential-one',
      'DELETE',
      env,
      { token }
    );

    expect(response.status).toBe(200);
    expect((await response.json()) as unknown).toEqual({ success: true });
    expect((await getPermission(env, USER_EMAIL)).passkeys).toEqual([retained]);
  });
});

describe('/auth/passkey/revoke characterization', () => {
  test('forbids a non-admin', async () => {
    const env = createTestEnv();
    await setPermission(env, USER_EMAIL, { role: APP_ROLE.USER });
    const token = await createSessionToken(env, USER_EMAIL);

    const response = await passkeyRequest('/auth/passkey/revoke', 'POST', env, {
      token,
      body: { userId: OTHER_EMAIL },
    });

    expect(response.status).toBe(403);
    expectJsonError((await response.json()) as unknown, 'Forbidden');
  });

  test('allows an admin to blacklist a user by userId', async () => {
    const env = createTestEnv();
    await setPermission(env, ADMIN_EMAIL, {
      role: APP_ROLE.USER,
      accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
    });
    await setPermission(env, OTHER_EMAIL, { name: 'Other User' });
    const token = await createSessionToken(env, ADMIN_EMAIL);

    const response = await passkeyRequest('/auth/passkey/revoke', 'POST', env, {
      token,
      body: { userId: OTHER_EMAIL },
    });

    expect(response.status).toBe(200);
    expect((await response.json()) as unknown).toEqual({ success: true });
    expect(await getPermission(env, OTHER_EMAIL)).toEqual({
      role: APP_ROLE.STUDENT,
      accessLevel: ACCESS_LEVEL.NONE,
      name: 'Other User',
      blacklisted: true,
    });
  });

  test('allows an admin to remove a credential across users', async () => {
    const env = createTestEnv();
    const revoked = createCredential('shared-credential', 'Old Key');
    const retained = createCredential('retained-credential', 'Current Key');
    await setPermission(env, ADMIN_EMAIL, {
      role: APP_ROLE.USER,
      accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
    });
    await setPermission(env, USER_EMAIL, {
      passkeys: [revoked, retained],
    });
    await setPermission(env, OTHER_EMAIL, {
      passkeys: [revoked],
    });
    const token = await createSessionToken(env, ADMIN_EMAIL);

    const response = await passkeyRequest('/auth/passkey/revoke', 'POST', env, {
      token,
      body: { credentialId: revoked.id },
    });

    expect(response.status).toBe(200);
    expect((await response.json()) as unknown).toEqual({ success: true });
    expect((await getPermission(env, USER_EMAIL)).passkeys).toEqual([retained]);
    expect((await getPermission(env, OTHER_EMAIL)).passkeys).toEqual([]);
  });
});
