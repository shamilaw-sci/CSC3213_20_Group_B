import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import {
  ACCESS_LEVEL,
  APP_ROLE,
  setUserPermission,
} from '@/repositories/permissions.repo';
import type { Env } from '@/types/env';

import { createTestEnv } from 'test/helpers/create-test-env';
import { createTestSessionCookie } from 'test/helpers/create-test-session';
import { invokeWorker } from 'test/helpers/invoke-worker';

const ORIGIN = 'https://portal.scs-pdn.space';
const ADMIN_EMAIL = 'admin@pdn.ac.lk';

async function projectPrRequest(env: Env): Promise<Response> {
  return invokeWorker(
    '/api/projects/v2/projects/example/pr',
    {
      headers: {
        Cookie: await createTestSessionCookie(env, ADMIN_EMAIL),
        Origin: ORIGIN,
        'X-Client-Id': 'portal',
      },
    },
    env
  );
}

async function adminEnv(): Promise<Env> {
  const env = createTestEnv();
  await setUserPermission(
    ADMIN_EMAIL,
    {
      role: APP_ROLE.ACADEMIC,
      accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
    },
    env
  );
  return env;
}

afterEach(() => {
  (globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.();
});

describe('GitHub App proxy contract', () => {
  test('preserves the successful pull-request status envelope', async () => {
    const env = await adminEnv();
    const upstream = {
      status: 'open',
      number: 41,
      url: 'https://github.com/example/repository/pull/41',
      branch: 'project/example',
      headSha: '0123456789abcdef0123456789abcdef01234567',
      canEdit: true,
    };
    const fetchMock = spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json(upstream)
    );

    const response = await projectPrRequest(env);

    expect(response.status).toBe(200);
    expect((await response.json()) as unknown).toEqual(upstream);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://github-app.test.scs-pdn.space/projects/public-project/pr?slug=example'
    );
  });

  test('normalizes an upstream conflict without losing its code', async () => {
    const env = await adminEnv();
    spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json(
        { code: 'stale_head', message: 'Refresh before submitting again.' },
        { status: 409 }
      )
    );

    const response = await projectPrRequest(env);

    expect(response.status).toBe(409);
    expect((await response.json()) as unknown).toEqual({
      code: 'stale_head',
      error: 'Refresh before submitting again.',
    });
  });
});
