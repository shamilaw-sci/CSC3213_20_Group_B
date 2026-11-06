import type { Env } from '@/types/env';
import { Database, type SQLQueryBindings } from 'bun:sqlite';

function createTestD1Database(): D1Database {
  const database = new Database(':memory:');
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE "user" ("id" text NOT NULL PRIMARY KEY, "name" text NOT NULL, "email" text NOT NULL UNIQUE, "emailVerified" integer NOT NULL, "image" text, "createdAt" integer NOT NULL, "updatedAt" integer NOT NULL);
    CREATE TABLE "session" ("id" text NOT NULL PRIMARY KEY, "expiresAt" integer NOT NULL, "token" text NOT NULL UNIQUE, "createdAt" integer NOT NULL, "updatedAt" integer NOT NULL, "ipAddress" text, "userAgent" text, "userId" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE);
    CREATE TABLE "account" ("id" text NOT NULL PRIMARY KEY, "accountId" text NOT NULL, "providerId" text NOT NULL, "userId" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" integer, "refreshTokenExpiresAt" integer, "scope" text, "password" text, "createdAt" integer NOT NULL, "updatedAt" integer NOT NULL);
    CREATE TABLE "verification" ("id" text NOT NULL PRIMARY KEY, "identifier" text NOT NULL, "value" text NOT NULL, "expiresAt" integer NOT NULL, "createdAt" integer NOT NULL, "updatedAt" integer NOT NULL);
    CREATE TABLE "passkey" ("id" text NOT NULL PRIMARY KEY, "name" text, "publicKey" text NOT NULL, "userId" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE, "credentialID" text NOT NULL, "counter" integer NOT NULL, "deviceType" text NOT NULL, "backedUp" integer NOT NULL, "transports" text, "createdAt" integer, "aaguid" text);
    CREATE TABLE "rateLimit" ("id" text NOT NULL PRIMARY KEY, "key" text NOT NULL UNIQUE, "count" integer NOT NULL, "lastRequest" integer NOT NULL);
    CREATE TABLE "public_avatar_rate" ("user_id" text PRIMARY KEY, "window_start" integer NOT NULL, "attempts" integer NOT NULL);
    CREATE TABLE "public_avatar_review" ("id" text PRIMARY KEY, "username" text NOT NULL, "sha256" text NOT NULL, "object_key" text NOT NULL, "size" integer NOT NULL, "moderation_json" text NOT NULL CHECK (json_valid("moderation_json")), "status" text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'approved', 'rejected')), "submitted_at" integer NOT NULL, "reviewed_at" integer, "reviewed_by" text, "review_note" text);
    CREATE INDEX "public_avatar_review_username_idx" ON "public_avatar_review" ("username");
    CREATE INDEX "public_avatar_review_status_idx" ON "public_avatar_review" ("status", "submitted_at");
    CREATE TABLE "public_avatar_audit" ("id" text PRIMARY KEY, "username" text NOT NULL, "actor_email" text NOT NULL, "actor_kind" text NOT NULL CHECK ("actor_kind" IN ('owner', 'admin')), "action" text NOT NULL CHECK ("action" IN ('upload', 'delete', 'admin_delete', 'review_submitted', 'review_approved', 'review_rejected')), "previous_sha256" text, "sha256" text, "review_id" text, "note" text, "created_at" integer NOT NULL);
    CREATE INDEX "public_avatar_audit_username_idx" ON "public_avatar_audit" ("username", "created_at");
    CREATE INDEX "public_avatar_audit_created_at_idx" ON "public_avatar_audit" ("created_at");
    CREATE TABLE "proxySettings" ("email" text NOT NULL PRIMARY KEY, "username" text NOT NULL, "active" integer NOT NULL DEFAULT 0 CHECK ("active" IN (0, 1)), "url" text NOT NULL DEFAULT '', "availableAttempts" integer NOT NULL DEFAULT 5 CHECK ("availableAttempts" BETWEEN 0 AND 5), "attemptWindowStartedAt" integer, "updatedAt" integer, "updatedBy" text, "revision" integer NOT NULL DEFAULT 1);
    CREATE TABLE "permission" ("email" text NOT NULL PRIMARY KEY COLLATE NOCASE, "permissionJson" text NOT NULL CHECK (json_valid("permissionJson")), "role" text NOT NULL CHECK ("role" IN ('USER', 'OTHER', 'STUDENT', 'ACADEMIC', 'NON_ACADEMIC', 'ACADEMIC_SUPPORT')), "accessLevel" text NOT NULL DEFAULT 'NONE' CHECK ("accessLevel" IN ('NONE', 'ADMIN', 'SUPER_ADMIN')), "name" text NOT NULL DEFAULT '', "picture" text NOT NULL DEFAULT '', "blacklisted" integer NOT NULL DEFAULT 0 CHECK ("blacklisted" IN (0, 1)), "createdAt" integer);
    CREATE INDEX "proxySettings_updatedAt_idx" ON "proxySettings" ("updatedAt");
    CREATE INDEX "proxySettings_username_idx" ON "proxySettings" ("username");
    CREATE INDEX "permission_accessLevel_idx" ON "permission" ("accessLevel");
    CREATE UNIQUE INDEX "account_provider_account_unique" ON "account" ("providerId", "accountId");
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
    return statement as unknown as D1PreparedStatement;
  }

  return {
    prepare,
    async batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      return Promise.all(statements.map((statement) => statement.all<T>()));
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

export function createTestEnv(overrides: Partial<Env> = {}): Env {
  return {
    AUTH_DB: createTestD1Database(),
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
  };
}
