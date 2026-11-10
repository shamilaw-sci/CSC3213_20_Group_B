import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';

import { createPostgresAuthDatabase } from '@/config/postgres-auth-database';
import { createPostgresPermissionRepository } from '@/repositories/permissions.postgres';
import {
  ACCESS_LEVEL,
  APP_ROLE,
  LastSuperAdminError,
  deleteUserPermission,
  getUserDataPage,
  getUserPermission,
  hasOtherSuperAdmin,
  setNotificationPreferences,
  setUserPermission,
} from '@/repositories/permissions.repo';
import type { Env } from '@/types/env';
import { createTestEnv } from 'test/helpers/create-test-env';

async function checkContract(first: Env, second: Env) {
  const email = 'alice@sci.pdn.ac.lk';
  expect(await getUserPermission(email, first)).toBeNull();
  await setUserPermission(
    email.toUpperCase(),
    {
      role: APP_ROLE.STUDENT,
      accessLevel: ACCESS_LEVEL.NONE,
      name: 'Alice',
      picture: 'avatar.webp',
      pictureMode: 'manual',
      include: { projects: 'EDITOR' },
      exclude: ['private'],
      notifications: { email: true, push: false },
      blacklisted: false,
      createdAt: 1_700_000_000_000,
    },
    first
  );
  expect(await getUserPermission(email, second)).toMatchObject({
    role: APP_ROLE.STUDENT,
    accessLevel: ACCESS_LEVEL.NONE,
    name: 'Alice',
    include: { projects: 'EDITOR' },
    createdAt: 1_700_000_000_000,
  });
  await setNotificationPreferences(email, { email: false, push: true }, second);
  expect((await getUserPermission(email, first))?.notifications).toEqual({
    email: false,
    push: true,
  });
  await setUserPermission(
    'bob@sci.pdn.ac.lk',
    { role: APP_ROLE.ACADEMIC, accessLevel: ACCESS_LEVEL.ADMIN },
    first
  );
  const firstPage = await getUserDataPage(second, { limit: 1 });
  expect(firstPage.users).toHaveLength(1);
  expect(firstPage.nextCursor).toBe(email);
  expect(firstPage.users[0]).toMatchObject({
    email,
    blacklisted: false,
    createdAt: 1_700_000_000_000,
  });
  const lastPage = await getUserDataPage(first, {
    cursor: firstPage.nextCursor!,
    limit: 1,
  });
  expect(lastPage.users.map((user) => user.email)).toEqual([
    'bob@sci.pdn.ac.lk',
  ]);
  expect(lastPage.nextCursor).toBeNull();
  expect(await hasOtherSuperAdmin(email, first)).toBe(false);
  await deleteUserPermission(email, second);
  expect(await getUserPermission(email, first)).toBeNull();
}

test('D1 permission contract', async () => {
  const env = createTestEnv();
  await checkContract(env, env);
});

const postgresTest = process.env.POSTGRES_TEST_URL ? test : test.skip;

postgresTest(
  'PostgreSQL permission contract and concurrent super-admin protection',
  async () => {
    const connectionString = process.env.POSTGRES_TEST_URL!;
    const schema = `scs_permission_${crypto.randomUUID().replaceAll('-', '')}`;
    const admin = new Pool({ connectionString });
    await admin.query(`CREATE SCHEMA "${schema}"`);
    const firstPool = createPostgresAuthDatabase({
      connectionString,
      schema,
      maxConnections: 6,
    });
    const secondPool = createPostgresAuthDatabase({
      connectionString,
      schema,
      maxConnections: 6,
    });
    try {
      const sql = await readFile(
        new URL('../migrations/postgres/0005_permissions.sql', import.meta.url),
        'utf8'
      );
      await firstPool.query(sql);
      const base = createTestEnv();
      const first = {
        ...base,
        PERMISSION_REPOSITORY: createPostgresPermissionRepository(firstPool),
      };
      const second = {
        ...base,
        PERMISSION_REPOSITORY: createPostgresPermissionRepository(secondPool),
      };
      await checkContract(first, second);
      await Promise.all(
        ['admin1@sci.pdn.ac.lk', 'admin2@sci.pdn.ac.lk'].map((email) =>
          setUserPermission(
            email,
            { role: APP_ROLE.USER, accessLevel: ACCESS_LEVEL.SUPER_ADMIN },
            first
          )
        )
      );
      const results = await Promise.allSettled([
        setUserPermission(
          'admin1@sci.pdn.ac.lk',
          { role: APP_ROLE.USER, accessLevel: ACCESS_LEVEL.NONE },
          first
        ),
        deleteUserPermission('admin2@sci.pdn.ac.lk', second),
      ]);
      expect(
        results.filter((result) => result.status === 'fulfilled')
      ).toHaveLength(1);
      expect(
        results.filter(
          (result) =>
            result.status === 'rejected' &&
            result.reason instanceof LastSuperAdminError
        )
      ).toHaveLength(1);
      const remaining = await firstPool.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM permission WHERE "accessLevel" = $1',
        [ACCESS_LEVEL.SUPER_ADMIN]
      );
      expect(remaining.rows[0]?.count).toBe('1');
      await expect(
        firstPool.query(
          'INSERT INTO permission (email, "permissionJson", role) VALUES ($1, $2::jsonb, $3)',
          ['ADMIN1@SCI.PDN.AC.LK', '{}', APP_ROLE.USER]
        )
      ).rejects.toThrow();
    } finally {
      await Promise.all([firstPool.end(), secondPool.end()]);
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.end();
    }
  }
);
