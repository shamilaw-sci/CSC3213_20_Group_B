import { getMigrations } from 'better-auth/db/migration';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';

import { authOptions, createAuth } from '@/auth/auth';
import { createPostgresAuthDatabase } from '@/config/postgres-auth-database';
import { createPostgresAuthIdentityRepository } from '@/repositories/auth-accounts.postgres';
import { getAuthIdentityByEmail } from '@/repositories/auth-accounts.repo';
import { createTestEnv } from 'test/helpers/create-test-env';

const postgresTest = process.env.POSTGRES_TEST_URL ? test : test.skip;

postgresTest(
  'Better Auth migrates and reads sessions on PostgreSQL',
  async () => {
    const connectionString = process.env.POSTGRES_TEST_URL!;
    const schema = `scs_auth_${crypto.randomUUID().replaceAll('-', '')}`;
    const admin = new Pool({ connectionString });
    await admin.query(`CREATE SCHEMA "${schema}"`);
    const database = createPostgresAuthDatabase({
      connectionString,
      maxConnections: 2,
      schema,
    });
    try {
      const env = createTestEnv({
        AUTH_DATABASE: database,
        BETTER_AUTH_URL: 'http://localhost:8787',
      });
      for (const file of [
        '0001_better_auth.sql',
        '0002_auth_identity_uniqueness.sql',
      ]) {
        const sql = await readFile(
          new URL(`../../migrations/postgres/${file}`, import.meta.url),
          'utf8'
        );
        await database.query(sql);
      }
      const options = authOptions(
        new Request('http://localhost:8787/api/auth/ok'),
        env
      );
      expect(options.database).toBe(database);
      const tables = await database.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = $1`,
        [schema]
      );
      expect(tables.rows.map((row) => row.table_name)).toEqual(
        expect.arrayContaining([
          'user',
          'session',
          'account',
          'verification',
          'passkey',
          'rateLimit',
        ])
      );
      const after = await getMigrations(options);
      expect(after.toBeCreated).toHaveLength(0);
      expect(after.toBeAdded).toHaveLength(0);
      expect(after.toBeAddedIndexes).toHaveLength(0);
      await database.query(
        'INSERT INTO "user" ("id", "name", "email", "emailVerified") VALUES ($1, $2, $3, $4)',
        ['u1', 'Test User', 'test@sci.pdn.ac.lk', true]
      );
      await database.query(
        'INSERT INTO "session" ("id", "token", "userId", "expiresAt", "updatedAt") VALUES ($1, $2, $3, $4, $5)',
        [
          's1',
          'test-session-token',
          'u1',
          new Date(Date.now() + 60_000),
          new Date(),
        ]
      );
      const auth = createAuth(
        new Request('http://localhost:8787/api/auth/ok'),
        env
      );
      const context = await auth.$context;
      const session =
        await context.internalAdapter.findSession('test-session-token');
      expect(session?.user.email).toBe('test@sci.pdn.ac.lk');
      await database.query(
        'INSERT INTO "account" ("id", "accountId", "providerId", "userId", "updatedAt") VALUES ($1, $2, $3, $4, $5)',
        ['a1', 'github-123', 'github', 'u1', new Date()]
      );
      await expect(
        database.query(
          'INSERT INTO "account" ("id", "accountId", "providerId", "userId", "updatedAt") VALUES ($1, $2, $3, $4, $5)',
          ['a2', 'github-123', 'github', 'u1', new Date()]
        )
      ).rejects.toMatchObject({ code: '23505' });
      const identity = await getAuthIdentityByEmail('TEST@SCI.PDN.AC.LK', {
        ...env,
        AUTH_IDENTITY_REPOSITORY:
          createPostgresAuthIdentityRepository(database),
      });
      expect(identity).toEqual({
        userId: 'u1',
        providers: new Set(['github']),
      });
    } finally {
      await database.end();
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.end();
    }
  }
);
