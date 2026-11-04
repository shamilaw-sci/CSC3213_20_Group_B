export interface Env {
  AUTH_DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;

  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;

  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;

  MAILER_API_URL: string;
  MAILER_API_KEY: string;

  GITHUB_APP_API_URL: string;
  GITHUB_APP_INTERNAL_SECRET: string;
  GITHUB_APP?: Fetcher;

  DATA_PUBLIC_BASE_URL: string;
  WEB_PROXY_INTERNAL_SECRET: string;
  TYPESAFE_API_KEY: string;
  PROFILE_PICTURES: R2Bucket;
  IMAGES: ImagesBinding;
}
