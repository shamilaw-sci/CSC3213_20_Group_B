import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dir, '../..');
const appDirectories = ['web', 'people', 'projects', 'portal', 'docs'] as const;

describe('Next.js route loading states', () => {
  test('gives every page a loading UI in the same route segment', async () => {
    const pages: string[] = [];

    for (const app of appDirectories) {
      const appRoot = resolve(repositoryRoot, 'apps', app, 'src', 'app');
      const glob = new Bun.Glob('**/page.tsx');

      for await (const page of glob.scan({ cwd: appRoot })) {
        pages.push(resolve(appRoot, page));
      }
    }

    const missingLoadingFiles = pages
      .map((page) => resolve(page, '..', 'loading.tsx'))
      .filter((loading) => !existsSync(loading))
      .map((loading) => loading.slice(repositoryRoot.length + 1))
      .sort();

    expect(missingLoadingFiles).toEqual([]);
  });
});
