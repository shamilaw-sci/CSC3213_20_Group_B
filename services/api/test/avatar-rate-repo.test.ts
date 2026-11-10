import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';

import { createPostgresAuthDatabase } from '@/config/postgres-auth-database';
import {
  type AvatarRateRepository,
  createD1AvatarRateRepository,
} from '@/repositories/public-avatar-rate.repo';
import { createPostgresAvatarRateRepository } from '@/repositories/public-avatar-rate.postgres';
import { createTestEnv } from 'test/helpers/create-test-env';

async function checkRateContract(
  first: AvatarRateRepository,
  second: AvatarRateRepository
) {
  expect(await first.read('alice')).toBeNull();
  const windowStart = 1_700_000_000_000;
  const attempts = await Promise.all(
    Array.from({ length: 16 }, (_, index) =>
      (index % 2 ? first : second).consume('alice', windowStart)
    )
  );
  expect(attempts.toSorted((a, b) => a! - b!)).toEqual(
    Array.from({ length: 16 }, (_, index) => index + 1)
  );
  expect(await second.read('alice')).toEqual({ windowStart, attempts: 16 });
  expect(await first.consume('alice', windowStart + 3_600_000)).toBe(1);
  expect(await second.read('alice')).toEqual({
    windowStart: windowStart + 3_600_000,
    attempts: 1,
  });
  await second.reset('alice');
  expect(await first.read('alice')).toBeNull();
}

test('D1 avatar rate window contract', async () => {
  const database = createTestEnv().AUTH_DB;
  await checkRateContract(
    createD1AvatarRateRepository(database),
    createD1AvatarRateRepository(database)
  );
});

const postgresTest = process.env.POSTGRES_TEST_URL ? test : test.skip;

postgresTest(
  'PostgreSQL avatar rate window contract across pools',
  async () => {
    const connectionString = process.env.POSTGRES_TEST_URL!;
    const schema = `scs_rate_${crypto.randomUUID().replaceAll('-', '')}`;
    const admin = new Pool({ connectionString });
    await admin.query(`CREATE SCHEMA "${schema}"`);
    const firstPool = createPostgresAuthDatabase({
      connectionString,
      schema,
      maxConnections: 4,
    });
    const secondPool = createPostgresAuthDatabase({
      connectionString,
      schema,
      maxConnections: 4,
    });
    try {
      const migration = await readFile(
        new URL(
          '../migrations/postgres/0003_public_avatar_rate.sql',
          import.meta.url
        ),
        'utf8'
      );
      await firstPool.query(migration);
      await checkRateContract(
        createPostgresAvatarRateRepository(firstPool),
        createPostgresAvatarRateRepository(secondPool)
      );
    } finally {
      await Promise.all([firstPool.end(), secondPool.end()]);
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.end();
    }
  }
);
