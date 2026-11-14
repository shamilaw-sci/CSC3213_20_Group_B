import { expect, test } from 'bun:test';

import {
  orcidRepository,
  type OrcidLinkIntent,
} from '@/repositories/orcid.repo';
import { createTestEnv } from 'test/helpers/create-test-env';

async function user(
  env: ReturnType<typeof createTestEnv>,
  id: string,
  email: string
) {
  await env.AUTH_DB.prepare(
    'INSERT INTO "user" (id,name,email,"emailVerified","createdAt","updatedAt") VALUES (?,?,?,?,?,?)'
  )
    .bind(id, id, email, 1, Date.now(), Date.now())
    .run();
}

function intent(userId: string, stateHash: string): OrcidLinkIntent {
  return {
    userId,
    stateHash,
    sessionId: `session-${userId}`,
    portalOrigin: 'https://portal.scs-pdn.space',
    expiresAt: Date.now() + 60_000,
  };
}

test('connect, replacement, failure, and disconnect use one Better Auth account row', async () => {
  const env = createTestEnv();
  await user(env, 'u1', 'researcher@sci.pdn.ac.lk');
  const repo = orcidRepository(env);
  const first = intent('u1', 'state-1');
  await repo.saveIntent(first);
  expect(await repo.connect(first, '0000-0002-1825-0097')).toBe(true);
  expect(await repo.getForUser('u1')).toBe('0000-0002-1825-0097');
  expect(await repo.connect(first, '0000-0002-1694-233X')).toBe(false);
  const replacement = intent('u1', 'state-2');
  await repo.saveIntent(replacement);
  expect(await repo.getForUser('u1')).toBe('0000-0002-1825-0097');
  expect(await repo.connect(replacement, '0000-0002-1694-233X')).toBe(true);
  expect(await repo.getForUsername('researcher')).toBe('0000-0002-1694-233X');
  await repo.disconnect('u1');
  expect(await repo.getForUser('u1')).toBeNull();
});

test('one ORCID cannot be linked to two users and a later disconnect cancels pending callbacks', async () => {
  const env = createTestEnv();
  await user(env, 'u1', 'first@sci.pdn.ac.lk');
  await user(env, 'u2', 'second@sci.pdn.ac.lk');
  const repo = orcidRepository(env);
  const first = intent('u1', 'state-1');
  const second = intent('u2', 'state-2');
  await repo.saveIntent(first);
  await repo.saveIntent(second);
  expect(await repo.connect(first, '0000-0002-1825-0097')).toBe(true);
  await expect(repo.connect(second, '0000-0002-1825-0097')).rejects.toThrow();
  expect(await repo.getForUser('u2')).toBeNull();
  await repo.disconnect('u2');
  expect(await repo.connect(second, '0000-0002-1694-233X')).toBe(false);
});

test('ambiguous university usernames do not expose either ORCID association', async () => {
  const env = createTestEnv();
  await user(env, 'u1', 'same@sci.pdn.ac.lk');
  await user(env, 'u2', 'same@pdn.ac.lk');
  const repo = orcidRepository(env);
  const first = intent('u1', 'state-1');
  await repo.saveIntent(first);
  expect(await repo.connect(first, '0000-0002-1825-0097')).toBe(true);
  expect(await repo.getForUsername('same')).toBeNull();
});

test('a callback can consume its pending state only once', async () => {
  const env = createTestEnv();
  await user(env, 'u1', 'researcher@sci.pdn.ac.lk');
  const repo = orcidRepository(env);
  const pending = intent('u1', 'one-time-state');
  await repo.saveIntent(pending);
  const results = await Promise.all([
    repo.connect(pending, '0000-0002-1825-0097'),
    repo.connect(pending, '0000-0002-1694-233X'),
  ]);
  expect(results.sort()).toEqual([false, true]);
  expect(
    ['0000-0002-1825-0097', '0000-0002-1694-233X'].includes(
      (await repo.getForUser('u1')) ?? ''
    )
  ).toBe(true);
});
