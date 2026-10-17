import { describe, expect, test } from 'bun:test';
import { jwtVerify, SignJWT } from 'jose';

import type { Env } from '@/types/env';

import { createTestEnv } from 'test/helpers/create-test-env';
import { invokeWorker } from 'test/helpers/invoke-worker';

const ALLOWED_ORIGIN = 'https://portal.scs-pdn.space';
const ALLOWED_CLIENT_ID = 'portal';
const ERROR_REDIRECT_URL = 'https://portal.scs-pdn.space/login';

function googleRequest(path: string, env: Env): Promise<Response> {
  return invokeWorker(
    path,
    {
      method: 'GET',
      headers: { Origin: ALLOWED_ORIGIN },
    },
    env
  );
}

function googleCallback(
  query: string,
  env: Env,
  stateCookie?: string
): Promise<Response> {
  const headers: Record<string, string> = { Origin: ALLOWED_ORIGIN };
  if (stateCookie) {
    headers.Cookie = `oauth_state=${stateCookie}`;
  }

  return invokeWorker(
    `/auth/google/callback${query}`,
    {
      method: 'GET',
      headers,
    },
    env
  );
}

async function createStateToken(
  env: Env,
  payload: Record<string, unknown>,
  expiration: string | number = '5m'
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expiration)
    .setJti('test-oauth-state-id')
    .sign(new TextEncoder().encode(env.JWT_SECRET));
}

function getStateToken(response: Response): string {
  const cookies = response.headers.getSetCookie();
  expect(cookies).toHaveLength(1);

  const match = /^oauth_state=([^;]+);/.exec(cookies[0]);
  expect(match).not.toBeNull();
  return match![1];
}

function expectErrorRedirect(response: Response, error: string): void {
  expect(response.status).toBe(302);
  const location = new URL(response.headers.get('Location')!);
  expect(`${location.origin}${location.pathname}`).toBe(ERROR_REDIRECT_URL);
  expect(location.searchParams.get('error')).toBe(error);
}

describe('/auth/google characterization', () => {
  test('requires client_id', async () => {
    const response = await googleRequest('/auth/google', createTestEnv());

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('Missing client_id');
  });

  test('rejects an invalid client_id', async () => {
    const response = await googleRequest(
      '/auth/google?client_id=unknown-client',
      createTestEnv()
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('Invalid client_id');
  });

  test('redirects to Google with the current query and signed state cookie', async () => {
    const env = createTestEnv();
    const response = await googleRequest(
      '/auth/google?client_id=portal&signup=true&prompt=select_account',
      env
    );

    expect(response.status).toBe(302);

    const location = new URL(response.headers.get('Location')!);
    expect(location.origin).toBe('https://accounts.google.com');
    expect(location.pathname).toBe('/o/oauth2/v2/auth');
    expect(location.searchParams.get('client_id')).toBe(env.GOOGLE_CLIENT_ID);
    expect(location.searchParams.get('redirect_uri')).toBe(
      env.GOOGLE_REDIRECT_URI
    );
    expect(location.searchParams.get('response_type')).toBe('code');
    expect(location.searchParams.get('scope')).toBe('openid email profile');
    expect(location.searchParams.get('prompt')).toBe('select_account');

    const stateToken = getStateToken(response);
    expect(response.headers.getSetCookie()[0]).toBe(
      `oauth_state=${stateToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=18000`
    );

    const { payload } = await jwtVerify(
      stateToken,
      new TextEncoder().encode(env.JWT_SECRET)
    );
    expect(payload.csrf).toBe(location.searchParams.get('state'));
    expect(payload.clientId).toBe(ALLOWED_CLIENT_ID);
    expect(payload.isSignup).toBe(true);
    expect(typeof payload.exp).toBe('number');
    expect(typeof payload.jti).toBe('string');
  });

  test('defaults signup to false and omits an unrequested prompt', async () => {
    const env = createTestEnv();
    const response = await googleRequest('/auth/google?client_id=portal', env);
    const location = new URL(response.headers.get('Location')!);
    const stateToken = getStateToken(response);
    const { payload } = await jwtVerify(
      stateToken,
      new TextEncoder().encode(env.JWT_SECRET)
    );

    expect(payload.isSignup).toBe(false);
    expect(location.searchParams.has('prompt')).toBe(false);
  });
});

describe('/auth/google/callback characterization', () => {
  test('rejects a missing state cookie', async () => {
    const response = await googleCallback(
      '?state=state-value&code=code-value',
      createTestEnv()
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('Missing state');
  });

  test('rejects a validly signed state with an invalid payload', async () => {
    const env = createTestEnv();
    const stateToken = await createStateToken(env, {
      csrf: 123,
      clientId: ALLOWED_CLIENT_ID,
    });

    const response = await googleCallback(
      '?state=state-value&code=code-value',
      env,
      stateToken
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe('Invalid state payload');
  });

  test('rejects a malformed state token as invalid or expired', async () => {
    const response = await googleCallback(
      '?state=state-value&code=code-value',
      createTestEnv(),
      'not-a-jwt'
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe('Invalid or expired state');
  });

  test('rejects an expired state token as invalid or expired', async () => {
    const env = createTestEnv();
    const stateToken = await createStateToken(
      env,
      { csrf: 'state-value', clientId: ALLOWED_CLIENT_ID },
      Math.floor(Date.now() / 1000) - 60
    );

    const response = await googleCallback(
      '?state=state-value&code=code-value',
      env,
      stateToken
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe('Invalid or expired state');
  });

  test('redirects provider callback errors to the current client error page', async () => {
    const env = createTestEnv();
    const stateToken = await createStateToken(env, {
      csrf: 'state-value',
      clientId: ALLOWED_CLIENT_ID,
    });

    const response = await googleCallback(
      '?error=access_denied',
      env,
      stateToken
    );

    expectErrorRedirect(response, 'google_access_denied');
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  test('redirects a state mismatch as invalid_state', async () => {
    const env = createTestEnv();
    const stateToken = await createStateToken(env, {
      csrf: 'expected-state',
      clientId: ALLOWED_CLIENT_ID,
    });

    const response = await googleCallback(
      '?state=different-state&code=code-value',
      env,
      stateToken
    );

    expectErrorRedirect(response, 'invalid_state');
  });

  test('redirects a missing authorization code as missing_code', async () => {
    const env = createTestEnv();
    const stateToken = await createStateToken(env, {
      csrf: 'state-value',
      clientId: ALLOWED_CLIENT_ID,
    });

    const response = await googleCallback(
      '?state=state-value',
      env,
      stateToken
    );

    expectErrorRedirect(response, 'missing_code');
  });
});
