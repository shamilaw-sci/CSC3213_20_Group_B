import type { Env } from '@/types';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`FATAL: Environment variable "${key}" is not set`);
    process.exit(1);
  }
  return value;
}

export const env: Env = {
  MAILER_API_KEY: requireEnv('MAILER_API_KEY'),
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.example.com',
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || process.env.SMTP_USER || '',
  PORT: Number(process.env.PORT) || 3000,
};
