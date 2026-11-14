import { afterEach, expect, spyOn, test } from 'bun:test';

import { APP_ROLE, setUserPermission } from '@/repositories/permissions.repo';
import { createTestEnv } from 'test/helpers/create-test-env';
import { createTestSessionCookie } from 'test/helpers/create-test-session';
import { invokeWorker } from 'test/helpers/invoke-worker';

const origin = 'https://portal.scs-pdn.space';
const email = 'researcher@sci.pdn.ac.lk';

afterEach(() =>
  (globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.()
);

test('ORCID requires a verified Portal session and links only the authenticated token identity', async () => {
  const env = createTestEnv({
    ORCID_CLIENT_ID: 'APP-TEST',
    ORCID_CLIENT_SECRET: 'test-secret',
  });
  await setUserPermission(email, { role: APP_ROLE.ACADEMIC }, env);
  const denied = await invokeWorker(
    '/api/orcid/connect',
    { method: 'POST', headers: { Origin: origin } },
    env
  );
  expect(denied.status).toBe(401);
  const cookie = await createTestSessionCookie(env, email);
  const start = await invokeWorker(
    '/api/orcid/connect',
    { method: 'POST', headers: { Origin: origin, Cookie: cookie } },
    env
  );
  expect(start.status).toBe(200);
  const { url } = (await start.json()) as { url: string };
  const authorization = new URL(url);
  expect(authorization.origin).toBe('https://orcid.org');
  expect(authorization.searchParams.get('scope')).toBe('/authenticate');
  const state = authorization.searchParams.get('state')!;
  const callback = `/api/orcid/callback?state=${encodeURIComponent(state)}&code=oauth-code`;
  expect((await invokeWorker(callback, { headers: {} }, env)).status).toBe(303);
  spyOn(globalThis, 'fetch').mockImplementation((async () =>
    Response.json({
      orcid: '0000-0002-1825-0097',
      scope: '/authenticate',
      token_type: 'bearer',
      access_token: 'not-persisted',
    })) as unknown as typeof fetch);
  const completed = await invokeWorker(
    callback,
    { headers: { Cookie: cookie } },
    env
  );
  expect(completed.status).toBe(303);
  const mine = await invokeWorker(
    '/api/orcid/me',
    { headers: { Origin: origin, Cookie: cookie } },
    env
  );
  expect(await mine.json()).toEqual({ orcid: '0000-0002-1825-0097' });
  const publicLookup = await invokeWorker(
    '/api/orcid/public/researcher',
    {},
    env
  );
  expect(await publicLookup.json()).toEqual({ orcid: '0000-0002-1825-0097' });
  const disconnected = await invokeWorker(
    '/api/orcid/me',
    { method: 'DELETE', headers: { Origin: origin, Cookie: cookie } },
    env
  );
  expect(disconnected.status).toBe(200);
  expect(
    await (await invokeWorker('/api/orcid/public/researcher', {}, env)).json()
  ).toEqual({ orcid: null });
});

test('profile submission rejects a client assertion of ORCID verification', async () => {
  const env = createTestEnv();
  await setUserPermission(email, { role: APP_ROLE.ACADEMIC }, env);
  const response = await invokeWorker(
    '/api/people/v2/me/pr',
    {
      method: 'PUT',
      headers: {
        Origin: origin,
        'X-Client-Id': 'portal',
        Cookie: await createTestSessionCookie(env, email),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        profileKind: 'academic',
        profile: { orcidVerified: true },
      }),
    },
    env
  );
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({
    error: 'ORCID verification is managed by account linking',
  });
});
