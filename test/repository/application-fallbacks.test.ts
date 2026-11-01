import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');
const apps = ['web', 'people', 'projects', 'portal', 'docs'] as const;
const fallbackFiles = [
  'error.tsx',
  'global-error.tsx',
  'not-found.tsx',
  'global-not-found.tsx',
] as const;

function fallbackPath(app: (typeof apps)[number], file: string) {
  return resolve(root, `apps/${app}/src/app/${file}`);
}

describe('Next.js application fallback contracts', () => {
  for (const app of apps) {
    test(`${app} owns the complete fallback hierarchy`, () => {
      for (const file of fallbackFiles) {
        expect(existsSync(fallbackPath(app, file))).toBe(true);
      }
    });

    test(`${app} segment errors remain retryable client boundaries`, () => {
      const source = readFileSync(fallbackPath(app, 'error.tsx'), 'utf8');

      expect(source.startsWith("'use client';")).toBe(true);
      expect(source).toContain('reset: () => void');
      expect(source).toContain('<ErrorPageFlag');
      expect(source).toContain('<FeedbackState');
    });

    test(`${app} root fallbacks render standalone themed documents`, () => {
      for (const file of ['global-error.tsx', 'global-not-found.tsx']) {
        const source = readFileSync(fallbackPath(app, file), 'utf8');

        expect(source).toContain("import '@scs/ui/styles/theme.css';");
        expect(source).toContain("import '@/app/globals.css';");
        expect(source).toContain('<html');
        expect(source).toContain('<body');
        expect(source).toContain('<ThemeInitScript');
        expect(source).toContain('<FeedbackState');
      }
    });

    test(`${app} missing records use the shared feedback contract`, () => {
      const source = readFileSync(fallbackPath(app, 'not-found.tsx'), 'utf8');

      expect(source).toContain('<ErrorPageFlag');
      expect(source).toContain('<FeedbackState');
    });
  }

  test('fallbacks no longer depend on duplicated app-local theme helpers', () => {
    for (const app of apps) {
      for (const file of fallbackFiles) {
        const source = readFileSync(fallbackPath(app, file), 'utf8');
        expect(source).not.toContain('@/components/custom/theme/');
      }
    }
  });
});
