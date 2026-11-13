import { expect, test } from 'bun:test';

import {
  ACCESS_LEVEL,
  APP_ROLE,
  getUserPermission,
  setUserPermission,
} from '@/repositories/permissions.repo';
import {
  getIdentityHistory,
  listIdentityAccounts,
  saveIdentityDecision,
} from '@/repositories/identity.repo';
import { createTestEnv } from 'test/helpers/create-test-env';
import { createTestSessionCookie } from 'test/helpers/create-test-session';
import { invokeWorker } from 'test/helpers/invoke-worker';

test('verified OTHER account can be approved with audit and no access grant', async () => {
  const env = createTestEnv();
  const email = 'staff@sci.pdn.ac.lk';
  const adminEmail = 'admin@sci.pdn.ac.lk';
  const now = Date.now();
  await env.AUTH_DB.prepare(
    `INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind('staff1', 'Staff Member', email, 1, now, now)
    .run();
  await setUserPermission(
    email,
    { role: APP_ROLE.OTHER, name: 'Staff Member' },
    env
  );
  await setUserPermission(
    adminEmail,
    {
      role: APP_ROLE.OTHER,
      accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
    },
    env
  );
  const headers = {
    Origin: 'https://portal.scs-pdn.space',
    'X-Client-Id': 'portal',
    Cookie: await createTestSessionCookie(env, adminEmail),
    'Content-Type': 'application/json',
  };
  const response = await invokeWorker(
    '/api/admin/identity/decisions',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        expectedRole: 'OTHER',
        role: 'ACADEMIC',
        status: 'APPROVED',
        source: 'REVIEW',
        note: 'Department appointment verified',
      }),
    },
    env
  );
  expect(response.status).toBe(200);
  expect(await getUserPermission(email, env)).toMatchObject({
    role: 'ACADEMIC',
    accessLevel: 'NONE',
  });
  expect(
    (await listIdentityAccounts(env, { query: 'staff', limit: 25 })).items[0]
  ).toMatchObject({
    email,
    role: 'ACADEMIC',
    status: 'APPROVED',
    source: 'REVIEW',
    emailVerified: true,
  });
  expect(
    (
      await listIdentityAccounts(env, {
        query: 'staff',
        verified: 'unverified',
        limit: 25,
      })
    ).items
  ).toHaveLength(0);
  expect(await getIdentityHistory(env, email)).toMatchObject([
    {
      oldRole: 'OTHER',
      newRole: 'ACADEMIC',
      reviewedBy: adminEmail,
    },
  ]);
});

test('missing identity migration reports an actionable service error', async () => {
  const env = createTestEnv();
  const adminEmail = 'admin@sci.pdn.ac.lk';
  await setUserPermission(
    adminEmail,
    {
      role: APP_ROLE.OTHER,
      accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
    },
    env
  );
  await env.AUTH_DB.exec('DROP TABLE identity_review');
  const response = await invokeWorker(
    '/api/admin/identity/accounts',
    {
      headers: {
        Origin: 'https://portal.scs-pdn.space',
        'X-Client-Id': 'portal',
        Cookie: await createTestSessionCookie(env, adminEmail),
      },
    },
    env
  );
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({
    code: 'DATABASE_MIGRATION_REQUIRED',
  });
});

test('missing Honours history migration reports an actionable service error', async () => {
  const env = createTestEnv();
  const adminEmail = 'admin@sci.pdn.ac.lk';
  await setUserPermission(
    adminEmail,
    {
      role: APP_ROLE.OTHER,
      accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
    },
    env
  );
  await env.AUTH_DB.exec('DROP TABLE honours_operation_history');
  const response = await invokeWorker(
    '/api/admin/academic-rules/honours/history',
    {
      headers: {
        Origin: 'https://portal.scs-pdn.space',
        'X-Client-Id': 'portal',
        Cookie: await createTestSessionCookie(env, adminEmail),
      },
    },
    env
  );
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({
    code: 'DATABASE_MIGRATION_REQUIRED',
  });
});

test('identity search paginates and a review may retain OTHER', async () => {
  const env = createTestEnv();
  const adminEmail = 'reviewer@sci.pdn.ac.lk';
  const now = Date.now();
  for (const [id, email] of [
    ['staff-a', 'a@sci.pdn.ac.lk'],
    ['staff-b', 'b@sci.pdn.ac.lk'],
  ]) {
    await env.AUTH_DB.prepare(
      `INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(id, id, email, 1, now, now)
      .run();
    await setUserPermission(email, { role: APP_ROLE.OTHER, name: id }, env);
  }
  await setUserPermission(
    adminEmail,
    {
      role: APP_ROLE.OTHER,
      accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
    },
    env
  );
  const headers = {
    Origin: 'https://portal.scs-pdn.space',
    'X-Client-Id': 'portal',
    Cookie: await createTestSessionCookie(env, adminEmail),
  };
  const first = await invokeWorker(
    '/api/admin/identity/accounts?role=OTHER&limit=1',
    { headers },
    env
  );
  expect(first.status).toBe(200);
  const firstPage = (await first.json()) as {
    items: Array<{ email: string }>;
    nextCursor: string | null;
  };
  expect(firstPage.items.map((item) => item.email)).toEqual([
    'a@sci.pdn.ac.lk',
  ]);
  expect(firstPage.nextCursor).toBe('a@sci.pdn.ac.lk');
  const second = await invokeWorker(
    `/api/admin/identity/accounts?role=OTHER&limit=1&cursor=${encodeURIComponent(firstPage.nextCursor!)}`,
    { headers },
    env
  );
  expect(second.status).toBe(200);
  expect(
    ((await second.json()) as { items: Array<{ email: string }> }).items[0]
      ?.email
  ).toBe('b@sci.pdn.ac.lk');
  const decision = await invokeWorker(
    '/api/admin/identity/decisions',
    {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'a@sci.pdn.ac.lk',
        expectedRole: 'OTHER',
        role: 'OTHER',
        status: 'RETAINED_OTHER',
        source: 'REVIEW',
        note: 'Evidence insufficient',
      }),
    },
    env
  );
  expect(decision.status).toBe(200);
  expect(await getUserPermission('a@sci.pdn.ac.lk', env)).toMatchObject({
    role: 'OTHER',
  });
  expect(
    (await listIdentityAccounts(env, { query: 'a@', limit: 25 })).items[0]
  ).toMatchObject({
    status: 'RETAINED_OTHER',
    source: 'REVIEW',
    note: 'Evidence insufficient',
  });
});

test('identity decision cannot invent an account or change a student role', async () => {
  const env = createTestEnv();
  const adminEmail = 'admin@sci.pdn.ac.lk';
  await setUserPermission(
    adminEmail,
    {
      role: APP_ROLE.OTHER,
      accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
    },
    env
  );
  const headers = {
    Origin: 'https://portal.scs-pdn.space',
    'X-Client-Id': 'portal',
    Cookie: await createTestSessionCookie(env, adminEmail),
    'Content-Type': 'application/json',
  };
  const body = (email: string) =>
    JSON.stringify({
      email,
      expectedRole: 'OTHER',
      role: 'ACADEMIC',
      status: 'APPROVED',
      source: 'MANUAL',
      note: '',
    });
  expect(
    (
      await invokeWorker(
        '/api/admin/identity/decisions',
        {
          method: 'POST',
          headers,
          body: body('missing@sci.pdn.ac.lk'),
        },
        env
      )
    ).status
  ).toBe(404);
  expect(
    (
      await invokeWorker(
        '/api/admin/identity/decisions',
        {
          method: 'POST',
          headers,
          body: body('s21513@sci.pdn.ac.lk'),
        },
        env
      )
    ).status
  ).toBe(409);
});

test('legacy admin role edit saves permission fields and audit atomically', async () => {
  const env = createTestEnv();
  const email = 'colleague@sci.pdn.ac.lk';
  const adminEmail = 'admin@sci.pdn.ac.lk';
  const now = Date.now();
  await env.AUTH_DB.prepare(
    `INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind('colleague1', 'Colleague', email, 1, now, now)
    .run();
  await setUserPermission(
    email,
    { role: APP_ROLE.OTHER, name: 'Colleague' },
    env
  );
  await setUserPermission(
    adminEmail,
    { role: APP_ROLE.OTHER, accessLevel: ACCESS_LEVEL.SUPER_ADMIN },
    env
  );
  const response = await invokeWorker(
    `/api/admin/users/${encodeURIComponent(email)}`,
    {
      method: 'PATCH',
      headers: {
        Origin: 'https://portal.scs-pdn.space',
        'X-Client-Id': 'portal',
        Cookie: await createTestSessionCookie(env, adminEmail),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'ACADEMIC', name: 'Updated Colleague' }),
    },
    env
  );
  expect(response.status).toBe(200);
  expect(await getUserPermission(email, env)).toMatchObject({
    role: 'ACADEMIC',
    name: 'Updated Colleague',
  });
  const row = await env.AUTH_DB.prepare(
    'SELECT role, name FROM permission WHERE email = ?'
  )
    .bind(email)
    .first<{ role: string; name: string }>();
  expect(row).toEqual({ role: 'ACADEMIC', name: 'Updated Colleague' });
  expect(await getIdentityHistory(env, email)).toMatchObject([
    { oldRole: 'OTHER', newRole: 'ACADEMIC', reviewedBy: adminEmail },
  ]);
});

test('stale admin role edits leave the newer permission and audit intact', async () => {
  const env = createTestEnv();
  const email = 'colleague@sci.pdn.ac.lk';
  await setUserPermission(email, { role: APP_ROLE.OTHER, name: 'Before' }, env);
  const expectedPermission = (await getUserPermission(email, env))!;
  await setUserPermission(email, { role: APP_ROLE.OTHER, name: 'Newer' }, env);
  expect(expectedPermission.name).toBe('Before');
  expect((await getUserPermission(email, env))?.name).toBe('Newer');
  await expect(
    saveIdentityDecision(env, {
      email,
      oldRole: APP_ROLE.OTHER,
      role: APP_ROLE.ACADEMIC,
      status: 'APPROVED',
      source: 'MANUAL',
      note: '',
      actorEmail: 'admin@sci.pdn.ac.lk',
      nextPermission: { ...expectedPermission, role: APP_ROLE.ACADEMIC },
      expectedPermission,
    })
  ).rejects.toThrow();
  expect(await getUserPermission(email, env)).toMatchObject({
    role: APP_ROLE.OTHER,
    name: 'Newer',
  });
  expect(await getIdentityHistory(env, email)).toHaveLength(0);
});
