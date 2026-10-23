import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');
const appSourceGlob = new Bun.Glob('apps/*/src/**/*.{ts,tsx}');
const viewSourceGlob = new Bun.Glob('apps/*/src/views/**/*.{ts,tsx}');

async function matchingFiles(glob: Bun.Glob) {
  return Array.fromAsync(
    glob.scan({
      cwd: root,
      onlyFiles: true,
    })
  );
}

describe('application composition ownership', () => {
  test('applications do not retain a generic views layer', async () => {
    expect(await matchingFiles(viewSourceGlob)).toEqual([]);
  });

  test('application source does not import through the retired views alias', async () => {
    const imports = (await matchingFiles(appSourceGlob)).filter((path) =>
      readFileSync(resolve(root, path), 'utf8').includes('@/views')
    );

    expect(imports).toEqual([]);
  });

  test('reused compositions have explicit shared homes', () => {
    const sharedCompositions = [
      'apps/people/src/components/students/student-subject-page.tsx',
      'apps/people/src/components/students/student-subject-batch-page.tsx',
      'apps/projects/src/components/projects/registry-ui.tsx',
      'apps/projects/src/components/projects/project-collection.tsx',
      'apps/projects/src/components/projects/facet-index.tsx',
      'apps/portal/src/components/profiles/account-settings.tsx',
      'apps/portal/src/lib/auth/auth-errors.ts',
    ];

    for (const path of sharedCompositions) {
      expect(existsSync(resolve(root, path)), path).toBe(true);
    }
  });
});
