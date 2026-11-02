import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');
const sourceGlob = new Bun.Glob(
  '{apps,packages,services}/**/*.{ts,tsx,mts,cts}'
);
const excludedSegments = [
  '/.next/',
  '/.source/',
  '/.turbo/',
  '/coverage/',
  '/dist/',
  '/node_modules/',
] as const;
const generatedFiles = new Set([
  'apps/docs/next-env.d.ts',
  'apps/people/next-env.d.ts',
  'apps/portal/next-env.d.ts',
  'apps/projects/next-env.d.ts',
  'apps/web/next-env.d.ts',
]);
const relativeImportExceptions = new Set([
  /*
   * Fumadocs loads this config and its plugin dependency before the app's
   * TypeScript aliases exist.
   */
  'apps/docs/source.config.ts',
  'apps/docs/src/lib/remark-repository-variants.ts',
  // This package test intentionally loads non-exported workspace ESLint configs.
  'packages/eslint-config/test/config-exports.test.ts',
  // Native k6 resolves filesystem modules and cannot resolve TypeScript path aliases.
  'packages/performance/k6/load.ts',
  'packages/performance/k6/journeys.ts',
]);
const relativeImportPattern =
  /(?:from\s+|import\s*\(\s*|^\s*import\s+)['"]\.\.?\//mu;

async function repositorySourceFiles() {
  return Array.fromAsync(
    sourceGlob.scan({
      cwd: root,
      onlyFiles: true,
    })
  );
}

describe('workspace import aliases', () => {
  test('uses aliases for every resolvable TypeScript path import', async () => {
    const relativeImports = (await repositorySourceFiles())
      .map((path) => path.replaceAll('\\', '/'))
      .filter(
        (path) =>
          !excludedSegments.some((segment) => path.includes(segment)) &&
          !generatedFiles.has(path) &&
          !relativeImportExceptions.has(path)
      )
      .filter((path) =>
        relativeImportPattern.test(readFileSync(resolve(root, path), 'utf8'))
      );

    expect(relativeImports).toEqual([]);
  });
});
