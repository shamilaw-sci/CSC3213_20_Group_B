export interface Env {
  AUTH_DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;

  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;

  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;

  PERMISSIONS: KVNamespace;

  MAILER_API_URL: string;
  MAILER_API_KEY: string;

  GITHUB_APP_API_URL: string;
  GITHUB_APP_INTERNAL_SECRET: string;
  GITHUB_APP?: Fetcher;

  CONFIG_DATA_BASE_URL: string;
  CONFIG_ACCESS_TOKEN_SECRET: string;
  CONFIG_ACCESS_TOKEN_ISSUER: string;
  DATA_PUBLIC_BASE_URL: string;
}
