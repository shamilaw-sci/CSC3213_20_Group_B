import { expect, test } from 'bun:test';

import { getAuthIdentityByEmail } from '@/repositories/auth-accounts.repo';
import { createTestEnv } from 'test/helpers/create-test-env';

test('D1 auth identity lookup includes linked providers and GitHub ID', async () => {
  const env = createTestEnv();
  const now = Date.now();
  await env.AUTH_DB.prepare(
    'INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind('u1', 'Test User', 'test@sci.pdn.ac.lk', 1, now, now)
    .run();
  await env.AUTH_DB.prepare(
    'INSERT INTO account (id, accountId, providerId, userId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind('a1', '12345', 'github', 'u1', now, now)
    .run();
  expect(await getAuthIdentityByEmail('TEST@SCI.PDN.AC.LK', env)).toEqual({
    userId: 'u1',
    emailVerified: true,
    providers: new Set(['github']),
    githubUserId: 12345,
  });
  expect(await getAuthIdentityByEmail('missing@sci.pdn.ac.lk', env)).toBeNull();
});
