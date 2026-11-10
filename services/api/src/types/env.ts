import type { BinaryObjectStore } from '@scs/storage';

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
  AVATAR_STORAGE?: BinaryObjectStore;
  AVATAR_STORAGE_DRIVER?: 'r2' | 's3';
  AVATAR_S3_BUCKET?: string;
  AVATAR_S3_REGION?: string;
  AVATAR_S3_ENDPOINT?: string;
  AVATAR_S3_ACCESS_KEY_ID?: string;
  AVATAR_S3_SECRET_ACCESS_KEY?: string;
  IMAGES: ImagesBinding;
}
