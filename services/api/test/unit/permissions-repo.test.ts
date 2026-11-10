import { expect, test } from 'bun:test';

import {
  ACCESS_LEVEL,
  APP_ROLE,
  getUserPermission,
} from '@/repositories/permissions.repo';

import { createTestEnv } from 'test/helpers/create-test-env';

test('reads valid permission fields from a stored JSON record', async () => {
  const env = createTestEnv();
  await env.AUTH_DB.prepare(
    `INSERT INTO permission (email, permissionJson, role, accessLevel)
     VALUES (?, ?, ?, ?)`
  )
    .bind(
      'member@pdn.ac.lk',
      JSON.stringify({
        role: APP_ROLE.STUDENT,
        accessLevel: ACCESS_LEVEL.NONE,
        name: 5,
        include: { docs: 'EDITOR' },
      }),
      APP_ROLE.STUDENT,
      ACCESS_LEVEL.NONE
    )
    .run();

  expect(await getUserPermission('member@pdn.ac.lk', env)).toEqual({
    role: APP_ROLE.STUDENT,
    accessLevel: ACCESS_LEVEL.NONE,
    include: { docs: 'EDITOR' },
  });
});
