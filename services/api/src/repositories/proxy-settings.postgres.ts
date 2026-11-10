import type { Pool } from 'pg';

import {
  PROXY_ATTEMPTS_RESET_WINDOW_MS,
  PROXY_DEFAULT_AVAILABLE_ATTEMPTS,
} from '@/config/client.config';
import {
  defaultProxySettings,
  emailToUsername,
  type ProxySettingsRepository,
  type ProxySettingsRow,
  toProxySettings,
} from '@/repositories/proxy-settings.repo';

type PgProxyRow = Omit<
  ProxySettingsRow,
  'attemptWindowStartedAt' | 'updatedAt' | 'revision'
> & {
  attemptWindowStartedAt: string | null;
  updatedAt: string | null;
  revision: string;
};

const COLUMNS =
  'email, username, active, url, "availableAttempts", "attemptWindowStartedAt", "updatedAt", "updatedBy", revision';

function safeNumber(value: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number))
    throw new Error('Invalid proxy numeric value');
  return number;
}

function rowValue(row: PgProxyRow): ProxySettingsRow {
  return {
    ...row,
    attemptWindowStartedAt:
      row.attemptWindowStartedAt === null
        ? null
        : safeNumber(row.attemptWindowStartedAt),
    updatedAt: row.updatedAt === null ? null : safeNumber(row.updatedAt),
    revision: safeNumber(row.revision),
  };
}

function resultValue(row: PgProxyRow) {
  return toProxySettings(rowValue(row));
}

export function createPostgresProxySettingsRepository(
  pool: Pool
): ProxySettingsRepository {
  return {
    async get(email) {
      const normalizedEmail = email.trim().toLowerCase();
      const select = () =>
        pool.query<PgProxyRow>(
          `SELECT ${COLUMNS} FROM "proxySettings" WHERE email = $1 LIMIT 1`,
          [normalizedEmail]
        );
      const initial = (await select()).rows[0];
      if (!initial) return defaultProxySettings(normalizedEmail);
      const row = rowValue(initial);
      if (
        row.attemptWindowStartedAt !== null &&
        Date.now() - row.attemptWindowStartedAt >
          PROXY_ATTEMPTS_RESET_WINDOW_MS &&
        row.availableAttempts !== PROXY_DEFAULT_AVAILABLE_ATTEMPTS
      ) {
        const reset = await pool.query<PgProxyRow>(
          `UPDATE "proxySettings" SET "availableAttempts" = $1, "attemptWindowStartedAt" = NULL, revision = revision + 1 WHERE email = $2 AND "attemptWindowStartedAt" = $3 RETURNING ${COLUMNS}`,
          [
            PROXY_DEFAULT_AVAILABLE_ATTEMPTS,
            normalizedEmail,
            row.attemptWindowStartedAt,
          ]
        );
        if (reset.rows[0]) return resultValue(reset.rows[0]);
        const current = (await select()).rows[0];
        if (current) return resultValue(current);
      }
      return toProxySettings(row);
    },
    async resolve(username) {
      const result = await pool.query<{ url: string }>(
        'SELECT url FROM "proxySettings" WHERE username = $1 AND active = 1 ORDER BY email LIMIT 2',
        [username]
      );
      return result.rows.length === 1 ? result.rows[0] : null;
    },
    async save(input) {
      const email = input.email.trim().toLowerCase();
      const now = Date.now();
      const base = [
        email,
        emailToUsername(email),
        input.active ? 1 : 0,
        input.url,
        PROXY_DEFAULT_AVAILABLE_ATTEMPTS,
        now,
        input.actorEmail,
      ];
      const result = input.actorIsAdmin
        ? await pool.query<PgProxyRow>(
            `INSERT INTO "proxySettings" (email, username, active, url, "availableAttempts", "attemptWindowStartedAt", "updatedAt", "updatedBy", revision)
             VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, 1)
             ON CONFLICT (email) DO UPDATE SET active = EXCLUDED.active, url = EXCLUDED.url,
               "updatedAt" = EXCLUDED."updatedAt", "updatedBy" = EXCLUDED."updatedBy",
               revision = "proxySettings".revision + 1
             RETURNING ${COLUMNS}`,
            base
          )
        : await pool.query<PgProxyRow>(
            `INSERT INTO "proxySettings" (email, username, active, url, "availableAttempts", "attemptWindowStartedAt", "updatedAt", "updatedBy", revision)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
             ON CONFLICT (email) DO UPDATE SET active = EXCLUDED.active, url = EXCLUDED.url,
               "availableAttempts" = CASE WHEN "proxySettings"."attemptWindowStartedAt" IS NULL OR "proxySettings"."attemptWindowStartedAt" <= $9 THEN $10 ELSE "proxySettings"."availableAttempts" - 1 END,
               "attemptWindowStartedAt" = CASE WHEN "proxySettings"."attemptWindowStartedAt" IS NULL OR "proxySettings"."attemptWindowStartedAt" <= $9 THEN EXCLUDED."attemptWindowStartedAt" ELSE "proxySettings"."attemptWindowStartedAt" END,
               "updatedAt" = EXCLUDED."updatedAt", "updatedBy" = EXCLUDED."updatedBy",
               revision = "proxySettings".revision + 1
             WHERE "proxySettings"."attemptWindowStartedAt" IS NULL OR "proxySettings"."attemptWindowStartedAt" <= $9 OR "proxySettings"."availableAttempts" > 0
             RETURNING ${COLUMNS}`,
            [
              email,
              emailToUsername(email),
              input.active ? 1 : 0,
              input.url,
              PROXY_DEFAULT_AVAILABLE_ATTEMPTS - 1,
              now,
              now,
              input.actorEmail,
              now - PROXY_ATTEMPTS_RESET_WINDOW_MS,
              PROXY_DEFAULT_AVAILABLE_ATTEMPTS - 1,
            ]
          );
      const row = result.rows[0];
      return row
        ? { status: 'saved', settings: resultValue(row) }
        : { status: 'attempts_exhausted' };
    },
    async reset(email, actorEmail) {
      const normalizedEmail = email.trim().toLowerCase();
      const result = await pool.query<PgProxyRow>(
        `INSERT INTO "proxySettings" (email, username, active, url, "availableAttempts", "attemptWindowStartedAt", "updatedAt", "updatedBy", revision)
         VALUES ($1, $2, 0, '', $3, NULL, $4, $5, 1)
         ON CONFLICT (email) DO UPDATE SET "availableAttempts" = EXCLUDED."availableAttempts",
           "attemptWindowStartedAt" = NULL, "updatedAt" = EXCLUDED."updatedAt",
           "updatedBy" = EXCLUDED."updatedBy", revision = "proxySettings".revision + 1
         RETURNING ${COLUMNS}`,
        [
          normalizedEmail,
          emailToUsername(normalizedEmail),
          PROXY_DEFAULT_AVAILABLE_ATTEMPTS,
          Date.now(),
          actorEmail,
        ]
      );
      const row = result.rows[0];
      if (!row)
        throw new Error('PostgreSQL did not return reset proxy settings');
      return resultValue(row);
    },
    async listPage(input) {
      const client = await pool.connect();
      try {
        await client.query(
          'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY'
        );
        const rows = input.afterEmail
          ? await client.query<PgProxyRow>(
              `SELECT ${COLUMNS} FROM "proxySettings" WHERE email > $1 ORDER BY email LIMIT $2`,
              [input.afterEmail, input.limit + 1]
            )
          : await client.query<PgProxyRow>(
              `SELECT ${COLUMNS} FROM "proxySettings" ORDER BY email LIMIT $1`,
              [input.limit + 1]
            );
        const count = await client.query<{ total: string }>(
          'SELECT count(*) AS total FROM "proxySettings"'
        );
        await client.query('COMMIT');
        const hasMore = rows.rows.length > input.limit;
        const pageRows = rows.rows.slice(0, input.limit);
        return {
          settings: pageRows.map(resultValue),
          nextEmail: hasMore ? (pageRows.at(-1)?.email ?? null) : null,
          total: safeNumber(count.rows[0]?.total ?? '0'),
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
