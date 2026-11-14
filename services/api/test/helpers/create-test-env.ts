import type { Env } from '@/types/env';
import { Database, type SQLQueryBindings } from 'bun:sqlite';

function createTestD1Database(): D1Database {
  const database = new Database(':memory:');
  const preparedStatements = new WeakMap<
    D1PreparedStatement,
    {
      sql: string;
      values: SQLQueryBindings[];
    }
  >();
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE "user" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "email" TEXT NOT NULL UNIQUE, "emailVerified" INTEGER NOT NULL, "image" TEXT, "createdAt" INTEGER NOT NULL, "updatedAt" INTEGER NOT NULL);
    CREATE TABLE "session" ("id" TEXT NOT NULL PRIMARY KEY, "expiresAt" INTEGER NOT NULL, "token" TEXT NOT NULL UNIQUE, "createdAt" INTEGER NOT NULL, "updatedAt" INTEGER NOT NULL, "ipAddress" TEXT, "userAgent" TEXT, "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE);
    CREATE TABLE "account" ("id" TEXT NOT NULL PRIMARY KEY, "accountId" TEXT NOT NULL, "providerId" TEXT NOT NULL, "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE, "accessToken" TEXT, "refreshToken" TEXT, "idToken" TEXT, "accessTokenExpiresAt" INTEGER, "refreshTokenExpiresAt" INTEGER, "scope" TEXT, "password" TEXT, "createdAt" INTEGER NOT NULL, "updatedAt" INTEGER NOT NULL);
    CREATE TABLE "verification" ("id" TEXT NOT NULL PRIMARY KEY, "identifier" TEXT NOT NULL, "value" TEXT NOT NULL, "expiresAt" INTEGER NOT NULL, "createdAt" INTEGER NOT NULL, "updatedAt" INTEGER NOT NULL);
    CREATE TABLE "passkey" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT, "publicKey" TEXT NOT NULL, "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE, "credentialID" TEXT NOT NULL, "counter" INTEGER NOT NULL, "deviceType" TEXT NOT NULL, "backedUp" INTEGER NOT NULL, "transports" TEXT, "createdAt" INTEGER, "aaguid" TEXT);
    CREATE TABLE "rateLimit" ("id" TEXT NOT NULL PRIMARY KEY, "key" TEXT NOT NULL UNIQUE, "count" INTEGER NOT NULL, "lastRequest" INTEGER NOT NULL);
    CREATE TABLE "public_avatar_rate" ("user_id" TEXT PRIMARY KEY, "window_start" INTEGER NOT NULL, "attempts" INTEGER NOT NULL);
    CREATE TABLE "public_avatar_review" ("id" TEXT PRIMARY KEY, "username" TEXT NOT NULL, "sha256" TEXT NOT NULL, "object_key" TEXT NOT NULL, "size" INTEGER NOT NULL, "moderation_json" TEXT NOT NULL CHECK (json_valid("moderation_json")), "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'approved', 'rejected')), "submitted_at" INTEGER NOT NULL, "reviewed_at" INTEGER, "reviewed_by" TEXT, "review_note" TEXT);
    CREATE INDEX "public_avatar_review_username_idx" ON "public_avatar_review" ("username");
    CREATE INDEX "public_avatar_review_status_idx" ON "public_avatar_review" ("status", "submitted_at");
    CREATE TABLE "public_avatar_audit" ("id" TEXT PRIMARY KEY, "username" TEXT NOT NULL, "actor_email" TEXT NOT NULL, "actor_kind" TEXT NOT NULL CHECK ("actor_kind" IN ('owner', 'admin')), "action" TEXT NOT NULL CHECK ("action" IN ('upload', 'delete', 'admin_delete', 'review_submitted', 'review_approved', 'review_rejected')), "previous_sha256" TEXT, "sha256" TEXT, "review_id" TEXT, "note" TEXT, "created_at" INTEGER NOT NULL);
    CREATE INDEX "public_avatar_audit_username_idx" ON "public_avatar_audit" ("username", "created_at");
    CREATE INDEX "public_avatar_audit_created_at_idx" ON "public_avatar_audit" ("created_at");
    CREATE TABLE "proxySettings" ("email" TEXT NOT NULL PRIMARY KEY, "username" TEXT NOT NULL, "active" INTEGER NOT NULL DEFAULT 0 CHECK ("active" IN (0, 1)), "url" TEXT NOT NULL DEFAULT '', "availableAttempts" INTEGER NOT NULL DEFAULT 5 CHECK ("availableAttempts" BETWEEN 0 AND 5), "attemptWindowStartedAt" INTEGER, "updatedAt" INTEGER, "updatedBy" TEXT, "revision" INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE "permission" ("email" TEXT NOT NULL PRIMARY KEY COLLATE NOCASE, "permissionJson" TEXT NOT NULL CHECK (json_valid("permissionJson")), "role" TEXT NOT NULL CHECK ("role" IN ('USER', 'OTHER', 'STUDENT', 'ACADEMIC', 'NON_ACADEMIC', 'ACADEMIC_SUPPORT')), "accessLevel" TEXT NOT NULL DEFAULT 'NONE' CHECK ("accessLevel" IN ('NONE', 'ADMIN', 'SUPER_ADMIN')), "name" TEXT NOT NULL DEFAULT '', "picture" TEXT NOT NULL DEFAULT '', "blacklisted" INTEGER NOT NULL DEFAULT 0 CHECK ("blacklisted" IN (0, 1)), "createdAt" INTEGER);
    CREATE INDEX "proxySettings_updatedAt_idx" ON "proxySettings" ("updatedAt");
    CREATE INDEX "proxySettings_username_idx" ON "proxySettings" ("username");
    CREATE INDEX "permission_accessLevel_idx" ON "permission" ("accessLevel");
    CREATE TABLE "identity_review" ("email" TEXT PRIMARY KEY COLLATE NOCASE REFERENCES permission(email) ON DELETE CASCADE, "status" TEXT NOT NULL, "source" TEXT NOT NULL, "note" TEXT NOT NULL, "reviewed_by" TEXT NOT NULL, "reviewed_at" INTEGER NOT NULL);
    CREATE TABLE "identity_audit" ("id" TEXT NOT NULL PRIMARY KEY, "email" TEXT NOT NULL COLLATE NOCASE, "old_role" TEXT NOT NULL, "new_role" TEXT NOT NULL, "status" TEXT NOT NULL, "source" TEXT NOT NULL, "note" TEXT NOT NULL, "actor_email" TEXT NOT NULL, "created_at" INTEGER NOT NULL);
    CREATE TABLE "honours_operation_history" ("operation_id" TEXT PRIMARY KEY, "actor_email" TEXT NOT NULL, "batch" TEXT NOT NULL, "programme" TEXT NOT NULL, "action" TEXT NOT NULL, "reason" TEXT NOT NULL, "changes_json" TEXT NOT NULL, "created_at" INTEGER NOT NULL, "actor_subject_id" TEXT, "idempotency_key" TEXT, "correlation_id" TEXT, "apply_json" TEXT, "request_hash" TEXT, "status" TEXT NOT NULL DEFAULT 'accepted', "next_attempt_at" INTEGER NOT NULL DEFAULT 0, "lease_until" INTEGER NOT NULL DEFAULT 0, "lease_token" TEXT, "attempt_count" INTEGER NOT NULL DEFAULT 0, "accepted_at" INTEGER, "last_error" TEXT);
    CREATE UNIQUE INDEX "honours_operation_history_retry_idx" ON "honours_operation_history" ("actor_subject_id", "idempotency_key");
    CREATE UNIQUE INDEX "honours_operation_history_active_request_idx" ON "honours_operation_history" ("actor_subject_id", "request_hash") WHERE "status" IN ('pending_acceptance', 'accepted', 'processing', 'awaiting_publication');
    CREATE UNIQUE INDEX "account_provider_account_unique" ON "account" ("providerId", "accountId");
    CREATE UNIQUE INDEX "account_one_orcid_per_user" ON "account" ("userId", "providerId") WHERE "providerId" = 'orcid';
    CREATE TABLE "orcid_link_intent" ("userId" TEXT NOT NULL PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE, "stateHash" TEXT NOT NULL UNIQUE, "sessionId" TEXT NOT NULL, "portalOrigin" TEXT NOT NULL, "expiresAt" INTEGER NOT NULL);
    CREATE UNIQUE INDEX "passkey_credentialID_unique" ON "passkey" ("credentialID");
  `);

  function normalize(value: unknown): unknown {
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'boolean') return value ? 1 : 0;
    return value;
  }

  function prepare(sql: string): D1PreparedStatement {
    let values: SQLQueryBindings[] = [];
    const statement = {
      bind(...bindings: unknown[]) {
        values = bindings.map(normalize) as SQLQueryBindings[];
        preparedStatements.set(statement as unknown as D1PreparedStatement, {
          sql,
          values,
        });
        return statement;
      },
      async first<T>(columnName?: string): Promise<T | null> {
        const row = database.query(sql).get(...values) as Record<
          string,
          unknown
        > | null;
        if (!row) return null;
        return (columnName ? row[columnName] : row) as T;
      },
      async run<T>(): Promise<D1Result<T>> {
        const result = database.query(sql).run(...values);
        return {
          success: true,
          meta: {
            changes: result.changes,
            duration: 0,
            last_row_id: Number(result.lastInsertRowid),
            changed_db: result.changes > 0,
            rows_read: 0,
            rows_written: result.changes,
            size_after: 0,
          },
          results: [],
        } as D1Result<T>;
      },
      async all<T>(): Promise<D1Result<T>> {
        return {
          success: true,
          meta: {},
          results: database.query(sql).all(...values) as T[],
        } as D1Result<T>;
      },
      async raw<T>(options?: { columnNames?: boolean }): Promise<T[]> {
        const query = database.query(sql);
        const rows = query.values(...values);
        if (!options?.columnNames) return rows as T[];
        const columns = query.columnNames;
        return [columns, ...rows] as T[];
      },
    };
    preparedStatements.set(statement as unknown as D1PreparedStatement, {
      sql,
      values,
    });
    return statement as unknown as D1PreparedStatement;
  }

  return {
    prepare,
    async batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      return database.transaction(() =>
        statements.map((statement) => {
          const binding = preparedStatements.get(statement);
          if (!binding) throw new Error('Unknown D1 test statement');
          const results = database
            .query(binding.sql)
            .all(...binding.values) as T[];
          return {
            success: true,
            meta: {
              changes: (
                database.query('SELECT changes() AS count').get() as {
                  count: number;
                }
              ).count,
            },
            results,
          } as D1Result<T>;
        })
      )();
    },
    async exec(query: string): Promise<D1ExecResult> {
      database.exec(query);
      return { count: 1, duration: 0 };
    },
    async dump(): Promise<ArrayBuffer> {
      return new ArrayBuffer(0);
    },
  } as unknown as D1Database;
}

export function createTestEnv(
  overrides: Partial<Env> = {}
): Env & { AUTH_DB: D1Database } {
  return {
    BETTER_AUTH_SECRET: 'test-better-auth-secret-at-least-32-characters',
    BETTER_AUTH_URL: 'https://test.scs-pdn.space',
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    GITHUB_CLIENT_ID: 'test-github-client-id',
    GITHUB_CLIENT_SECRET: 'test-github-client-secret',
    MAILER_API_URL: 'https://mailer.test.scs-pdn.space',
    MAILER_API_KEY: 'test-mailer-api-key',
    GITHUB_APP_API_URL: 'https://github-app.test.scs-pdn.space',
    GITHUB_APP_INTERNAL_SECRET: 'test-github-app-internal-secret',
    DATA_PUBLIC_BASE_URL: 'https://data.test.scs-pdn.space',
    WEB_PROXY_INTERNAL_SECRET: 'test-web-proxy-internal-secret',
    TYPESAFE_API_KEY: 'test-typesafe-api-key',
    PROFILE_PICTURES: {} as R2Bucket,
    IMAGES: {} as ImagesBinding,
    ...overrides,
    AUTH_DB: overrides.AUTH_DB ?? createTestD1Database(),
  };
}
