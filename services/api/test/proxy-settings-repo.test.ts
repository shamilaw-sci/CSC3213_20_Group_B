import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';

import { createPostgresAuthDatabase } from '@/config/postgres-auth-database';
import { PROXY_ATTEMPTS_RESET_WINDOW_MS } from '@/config/client.config';
import {
  getActiveProxyByUsername,
  getProxySettings,
  listProxySettingsPage,
  resetProxyAttempts,
  saveProxySettings,
} from '@/repositories/proxy-settings.repo';
import { createPostgresProxySettingsRepository } from '@/repositories/proxy-settings.postgres';
import type { Env } from '@/types/env';
import { createTestEnv } from 'test/helpers/create-test-env';

async function checkProxyContract(first: Env, second: Env) {
  const email = 'alice@sci.pdn.ac.lk';
  expect(await getProxySettings(first, email)).toMatchObject({
    email,
    username: 'alice',
    availableAttempts: 5,
    revision: 0,
  });
  const outcomes = await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      saveProxySettings({
        env: index % 2 ? first : second,
        email,
        actorEmail: email,
        actorIsAdmin: false,
        active: true,
        url: `https://example.com/${index}`,
      })
    )
  );
  expect(outcomes.filter((result) => result.status === 'saved')).toHaveLength(
    5
  );
  expect(
    outcomes.filter((result) => result.status === 'attempts_exhausted')
  ).toHaveLength(7);
  expect(await getProxySettings(second, email)).toMatchObject({
    availableAttempts: 0,
    revision: 5,
  });
  const admin = await saveProxySettings({
    env: first,
    email,
    actorEmail: 'admin@sci.pdn.ac.lk',
    actorIsAdmin: true,
    active: true,
    url: 'https://example.com/admin',
  });
  expect(admin).toMatchObject({
    status: 'saved',
    settings: { availableAttempts: 0, revision: 6 },
  });
  expect(await getActiveProxyByUsername(second, 'alice')).toEqual({
    url: 'https://example.com/admin',
  });
  expect(
    await resetProxyAttempts(second, email, 'admin@sci.pdn.ac.lk')
  ).toMatchObject({
    availableAttempts: 5,
    revision: 7,
  });
  await saveProxySettings({
    env: first,
    email: 'alice@eng.pdn.ac.lk',
    actorEmail: 'admin@sci.pdn.ac.lk',
    actorIsAdmin: true,
    active: true,
    url: 'https://example.com/other',
  });
  expect(await getActiveProxyByUsername(first, 'alice')).toBeNull();
  const page = await listProxySettingsPage(second, { limit: 1 });
  expect(page.total).toBe(2);
  expect(page.settings).toHaveLength(1);
  expect(page.nextEmail).toBe(page.settings[0]?.email);
  const next = await listProxySettingsPage(first, {
    afterEmail: page.nextEmail!,
    limit: 1,
  });
  expect(next.settings).toHaveLength(1);
  expect(next.nextEmail).toBeNull();
}

test('D1 proxy settings contract and concurrent attempts', async () => {
  const env = createTestEnv();
  await checkProxyContract(env, env);
  await env.AUTH_DB.prepare(
    'UPDATE proxySettings SET availableAttempts = 0, attemptWindowStartedAt = ? WHERE email = ?'
  )
    .bind(
      Date.now() - PROXY_ATTEMPTS_RESET_WINDOW_MS - 1,
      'alice@sci.pdn.ac.lk'
    )
    .run();
  expect(await getProxySettings(env, 'alice@sci.pdn.ac.lk')).toMatchObject({
    availableAttempts: 5,
    revision: 8,
  });
});

const postgresTest = process.env.POSTGRES_TEST_URL ? test : test.skip;

postgresTest('PostgreSQL proxy settings contract across pools', async () => {
  const connectionString = process.env.POSTGRES_TEST_URL!;
  const schema = `scs_proxy_${crypto.randomUUID().replaceAll('-', '')}`;
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
      new URL(
        '../migrations/postgres/0004_proxy_settings.sql',
        import.meta.url
      ),
      'utf8'
    );
    await firstPool.query(sql);
    const base = createTestEnv();
    await checkProxyContract(
      {
        ...base,
        PROXY_SETTINGS_REPOSITORY:
          createPostgresProxySettingsRepository(firstPool),
      },
      {
        ...base,
        PROXY_SETTINGS_REPOSITORY:
          createPostgresProxySettingsRepository(secondPool),
      }
    );
    await firstPool.query(
      'UPDATE "proxySettings" SET "availableAttempts" = 0, "attemptWindowStartedAt" = $1 WHERE email = $2',
      [Date.now() - PROXY_ATTEMPTS_RESET_WINDOW_MS - 1, 'alice@sci.pdn.ac.lk']
    );
    expect(
      await createPostgresProxySettingsRepository(secondPool).get(
        'alice@sci.pdn.ac.lk'
      )
    ).toMatchObject({ availableAttempts: 5, revision: 8 });
  } finally {
    await Promise.all([firstPool.end(), secondPool.end()]);
    await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
  }
});
