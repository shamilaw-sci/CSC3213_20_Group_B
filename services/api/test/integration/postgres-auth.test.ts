import { getMigrations } from 'better-auth/db/migration';
import { betterAuth } from 'better-auth';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';

import { authOptions, createAuth } from '@/auth/auth';
import { createPostgresAuthDatabase } from '@/config/postgres-auth-database';
import { createPostgresRelationalBindings } from '@/config/postgres-relational-bindings';
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
        ...createPostgresRelationalBindings(database),
        BETTER_AUTH_URL: 'http://localhost:8787',
      });
      const migrationClient = await database.connect();
      try {
        await migrationClient.query('BEGIN');
        for (const file of [
          '0001_better_auth.sql',
          '0002_auth_identity_uniqueness.sql',
          '0003_public_avatar_rate.sql',
          '0004_proxy_settings.sql',
          '0005_permissions.sql',
          '0006_public_avatar_moderation.sql',
        ]) {
          const sql = await readFile(
            new URL(`../../migrations/postgres/${file}`, import.meta.url),
            'utf8'
          );
          await migrationClient.query(sql);
        }
        await migrationClient.query('COMMIT');
      } catch (error) {
        await migrationClient.query('ROLLBACK');
        throw error;
      } finally {
        migrationClient.release();
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
          'public_avatar_rate',
          'proxySettings',
          'permission',
          'public_avatar_review',
          'public_avatar_audit',
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
      const now = Date.now();
      await database.query(
        'INSERT INTO "rateLimit" (id, key, count, "lastRequest") VALUES ($1, $2, $3, $4)',
        ['r1', 'probe', 1, now]
      );
      const rateRow = await context.adapter.findOne<{ lastRequest: number }>({
        model: 'rateLimit',
        where: [{ field: 'key', value: 'probe' }],
      });
      expect(rateRow?.lastRequest).toBe(now);
      expect(typeof rateRow?.lastRequest).toBe('number');
      await expect(
        database.query('SELECT 9007199254740992::bigint AS unsafe_value')
      ).rejects.toThrow('safe integer range');
      const limitedAuth = betterAuth({
        ...options,
        rateLimit: { enabled: true, storage: 'database', window: 60, max: 1 },
      });
      const limitedRequest = () =>
        new Request('http://localhost:8787/api/auth/ok', {
          headers: { 'cf-connecting-ip': '127.0.0.1' },
        });
      expect((await limitedAuth.handler(limitedRequest())).status).toBe(200);
      const blocked = await limitedAuth.handler(limitedRequest());
      expect(blocked.status).toBe(429);
      const retry = Number(blocked.headers.get('x-retry-after'));
      expect(retry).toBeGreaterThan(0);
      expect(retry).toBeLessThanOrEqual(60);
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
