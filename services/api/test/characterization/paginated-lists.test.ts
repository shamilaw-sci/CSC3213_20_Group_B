import { describe, expect, test } from 'bun:test';

import { ACCESS_LEVEL, APP_ROLE } from '@/repositories/permissions.repo';
import type { Env } from '@/types/env';

import { createTestEnv } from 'test/helpers/create-test-env';
import { createTestSessionCookie } from 'test/helpers/create-test-session';
import { invokeWorker } from 'test/helpers/invoke-worker';

const ORIGIN = 'https://portal.scs-pdn.space';
const ADMIN_EMAIL = 'admin@pdn.ac.lk';

describe('list endpoint characterization before cursor pagination', () => {
  test('admin users returns one bare array containing every seeded user', async () => {
    const env = createTestEnv();
    const users = Array.from({ length: 125 }, (_, index) => ({
      email: `user-${index.toString().padStart(3, '0')}@pdn.ac.lk`,
      permission: {
        role: APP_ROLE.STUDENT,
        name: `User ${index}`,
        createdAt: index,
      },
    }));

    await Promise.all([
      env.PERMISSIONS.put(
        `permissions:${ADMIN_EMAIL}`,
        JSON.stringify({
          role: APP_ROLE.ACADEMIC,
          accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
        })
      ),
      ...users.map(({ email, permission }) =>
        env.PERMISSIONS.put(`permissions:${email}`, JSON.stringify(permission))
      ),
    ]);

    const response = await invokeWorker(
      '/api/admin/users?limit=10',
      {
        headers: {
          Cookie: await createTestSessionCookie(env, ADMIN_EMAIL),
          Origin: ORIGIN,
          'X-Client-Id': 'portal',
        },
      },
      env
    );
    const payload = await response.text();
    const body = JSON.parse(payload) as unknown;

    expect(response.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(126);
    expect(body).not.toHaveProperty('nextCursor');
    expect(new TextEncoder().encode(payload).byteLength).toBe(20_171);
  });
});
