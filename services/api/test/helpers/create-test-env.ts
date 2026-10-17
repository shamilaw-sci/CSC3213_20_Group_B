import type { Env } from '@/types/env';

function createTestKvNamespace(): KVNamespace {
  const values = new Map<string, string>();

  return {
    async get(key: string): Promise<string | null> {
      return values.get(key) ?? null;
    },
    async put(key: string, value: string): Promise<void> {
      values.set(key, value);
    },
    async delete(key: string): Promise<void> {
      values.delete(key);
    },
    async list(options?: KVNamespaceListOptions) {
      const prefix = options?.prefix ?? '';
      return {
        keys: [...values.keys()]
          .filter((key) => key.startsWith(prefix))
          .map((name) => ({ name })),
        list_complete: true as const,
        cacheStatus: null,
      };
    },
  } as unknown as KVNamespace;
}

export function createTestEnv(overrides: Partial<Env> = {}): Env {
  return {
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
