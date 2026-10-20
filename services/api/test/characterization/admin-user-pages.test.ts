import { describe, expect, test } from 'bun:test';
import type { Page } from '@scs/schemas';

import {
  ACCESS_LEVEL,
  APP_ROLE,
  setUserPermission,
  type UserData,
} from '@/repositories/permissions.repo';
import type { Env } from '@/types/env';

import { createTestEnv } from 'test/helpers/create-test-env';
import { createTestSessionCookie } from 'test/helpers/create-test-session';
import { invokeWorker } from 'test/helpers/invoke-worker';

const ORIGIN = 'https://portal.scs-pdn.space';
const ADMIN_EMAIL = 'admin@pdn.ac.lk';

function countKvGets(env: Env): () => number {
  const namespace = env.PERMISSIONS;
  const originalGet = namespace.get.bind(namespace);
  let count = 0;
  env.PERMISSIONS = {
    ...namespace,
    get: ((...args: unknown[]) => {
      count += 1;
      return Reflect.apply(originalGet, namespace, args);
    }) as KVNamespace['get'],
  } as KVNamespace;
  return () => count;
}

async function requestPage(env: Env, query: string): Promise<Response> {
  return invokeWorker(
    `/api/admin/users/page${query}`,
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

describe('admin user pages', () => {
  test('returns bounded metadata pages without one KV get per listed user', async () => {
    const env = createTestEnv();
    await setUserPermission(
      ADMIN_EMAIL,
      {
        role: APP_ROLE.ACADEMIC,
        accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
        name: 'Admin',
      },
      env
    );
    for (let index = 0; index < 25; index += 1) {
      await setUserPermission(
        `user-${index.toString().padStart(2, '0')}@pdn.ac.lk`,
        {
          role: APP_ROLE.STUDENT,
          name: `User ${index}`,
          createdAt: index,
        },
        env
      );
    }
    const getCount = countKvGets(env);

    const firstResponse = await requestPage(env, '?limit=10');
    const first = (await firstResponse.json()) as Page<UserData>;

    expect(firstResponse.status).toBe(200);
    expect(first.items).toHaveLength(10);
    expect(first.page.hasMore).toBe(true);
    expect(first.page.nextCursor).toBeString();
    expect(getCount()).toBe(2);

    const secondResponse = await requestPage(
      env,
      `?limit=10&cursor=${encodeURIComponent(first.page.nextCursor!)}`
    );
    const second = (await secondResponse.json()) as Page<UserData>;
    expect(secondResponse.status).toBe(200);
    expect(second.items).toHaveLength(10);
    expect(
      new Set([...first.items, ...second.items].map((user) => user.email)).size
    ).toBe(20);
    expect(getCount()).toBe(4);
  });

  test('rejects page sizes above the shared maximum', async () => {
    const env = createTestEnv();
    await setUserPermission(
      ADMIN_EMAIL,
      {
        role: APP_ROLE.ACADEMIC,
        accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
      },
      env
    );
    const response = await requestPage(env, '?limit=101');
    expect(response.status).toBe(400);
  });
});
