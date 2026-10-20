import type { Env } from '@/types/env';

function createTestD1Database(): D1Database {
  return {
    prepare() {
      throw new Error('D1 queries are not available in legacy API tests');
    },
    batch() {
      throw new Error('D1 batches are not available in legacy API tests');
    },
    exec() {
      throw new Error('D1 exec is not available in legacy API tests');
    },
    dump() {
      throw new Error('D1 dump is not available in legacy API tests');
    },
  } as unknown as D1Database;
}

function createTestKvNamespace(): KVNamespace {
  const values = new Map<string, { value: string; metadata?: unknown }>();

  return {
    async get(key: string): Promise<string | null> {
      return values.get(key)?.value ?? null;
    },
    async put(
      key: string,
      value: string,
      options?: KVNamespacePutOptions
    ): Promise<void> {
      values.set(key, { value, metadata: options?.metadata });
    },
    async delete(key: string): Promise<void> {
      values.delete(key);
    },
    async list(options?: KVNamespaceListOptions) {
      const prefix = options?.prefix ?? '';
      const cursor = Number(options?.cursor ?? 0);
      const limit = options?.limit ?? 1000;
      const matching = [...values.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .sort(([left], [right]) => left.localeCompare(right));
      const end = Math.min(cursor + limit, matching.length);
      const listComplete = end >= matching.length;
      return {
        keys: matching.slice(cursor, end).map(([name, entry]) => ({
          name,
          metadata: entry.metadata,
        })),
        list_complete: listComplete,
        ...(listComplete ? {} : { cursor: String(end) }),
        cacheStatus: null,
      };
    },
  } as unknown as KVNamespace;
}

export function createTestEnv(overrides: Partial<Env> = {}): Env {
  return {
    AUTH_DB: createTestD1Database(),
    BETTER_AUTH_SECRET: 'test-better-auth-secret-at-least-32-characters',
    BETTER_AUTH_URL: 'https://test.scs-pdn.space',
    JWT_SECRET: 'test-jwt-secret',
    JWT_ISSUER: 'test.scs-pdn.space',
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    GOOGLE_REDIRECT_URI: 'https://test.scs-pdn.space/auth/google/callback',
    GITHUB_CLIENT_ID: 'test-github-client-id',
    GITHUB_CLIENT_SECRET: 'test-github-client-secret',
    GITHUB_REDIRECT_URI: 'https://test.scs-pdn.space/auth/github/callback',
    PERMISSIONS: createTestKvNamespace(),
    TOKEN_BLACKLIST: createTestKvNamespace(),
    MAGIC_CODES: createTestKvNamespace(),
    MAILER_API_URL: 'https://mailer.test.scs-pdn.space',
    MAILER_API_KEY: 'test-mailer-api-key',
    GITHUB_APP_API_URL: 'https://github-app.test.scs-pdn.space',
    GITHUB_APP_INTERNAL_SECRET: 'test-github-app-internal-secret',
    CONFIG_DATA_BASE_URL: 'https://config.test.scs-pdn.space',
    CONFIG_ACCESS_TOKEN_SECRET: 'test-config-access-token-secret',
    DATA_PUBLIC_BASE_URL: 'https://data.test.scs-pdn.space',
    ...overrides,
  };
}
