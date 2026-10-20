import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');
const catalog = readFileSync(
  resolve(root, 'docs/ENVIRONMENT_VARIABLES.md'),
  'utf8'
);

const workspaceVariables = {
  'apps/web/.env.example': [
    'BASE_DOMAIN',
    'CF_SECRET',
    'MOODLE_URL',
    'NEXT_PUBLIC_SITE_URL',
    'WORKER_URL',
  ],
  'apps/people/.env.example': [
    'NEXT_PUBLIC_PEOPLE_DATA_BASE_URL',
    'NEXT_PUBLIC_PROJECTS_DATA_BASE_URL',
    'NEXT_PUBLIC_PROJECTS_SITE_URL',
    'NEXT_PUBLIC_SITE_URL',
  ],
  'apps/projects/.env.example': [
    'NEXT_PUBLIC_PEOPLE_SITE_URL',
    'NEXT_PUBLIC_PROJECTS_DATA_BASE_URL',
    'NEXT_PUBLIC_SITE_URL',
  ],
  'apps/portal/.env.example': [
    'COOKIE_DOMAIN',
    'NEXT_PUBLIC_API_CLIENT_ID',
    'NEXT_PUBLIC_BASE_API_URL',
    'NEXT_PUBLIC_PEOPLE_DATA_BASE_URL',
    'NEXT_PUBLIC_SITE_URL',
    'NEXT_PUBLIC_VERIFICATION_CODE_MAX_LENGTH',
  ],
  'services/api/.dev.vars.example': [
    'BETTER_AUTH_SECRET',
    'CONFIG_ACCESS_TOKEN_SECRET',
    'GITHUB_APP_INTERNAL_SECRET',
    'GITHUB_CLIENT_SECRET',
    'GOOGLE_CLIENT_SECRET',
    'MAILER_API_KEY',
  ],
  'services/github-app/.env.example': [
    'GITHUB_APP_ID',
    'GITHUB_CONFIG_REPOSITORY',
    'GITHUB_INSTALLATION_ID',
    'GITHUB_OWNER',
    'GITHUB_PEOPLE_DATA_REPOSITORY',
    'GITHUB_PRIVATE_KEY',
    'GITHUB_PROJECTS_DATA_REPOSITORY',
    'PORT',
    'X_INTERNAL_SECRET',
  ],
  'services/mailer/.env.example': [
    'MAILER_API_KEY',
    'PORT',
    'SMTP_FROM',
    'SMTP_HOST',
    'SMTP_PASS',
    'SMTP_PORT',
    'SMTP_SECURE',
    'SMTP_USER',
    'VERCEL_EXPERIMENTAL_BACKENDS',
  ],
} as const;

function keysInTemplate(path: string): string[] {
  return readFileSync(resolve(root, path), 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => line.slice(0, line.indexOf('=')))
    .sort();
}

describe('environment configuration discovery', () => {
  for (const [path, variables] of Object.entries(workspaceVariables)) {
    test(`${path} lists its complete supported local configuration`, () => {
      expect(keysInTemplate(path)).toEqual([...variables].sort());
    });
  }

  test('the root catalog names every templated variable', () => {
    const variables = new Set(Object.values(workspaceVariables).flat());

    for (const variable of variables) {
      expect(catalog).toContain(`\`${variable}\``);
    }
  });
});
