import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');
const apps = ['web', 'people', 'projects', 'portal'] as const;
const appSourceGlob = new Bun.Glob('apps/*/src/**/*.{js,jsx,ts,tsx}');
const customComponentGlob = new Bun.Glob('apps/*/src/components/custom/**/*');
const viewSourceGlob = new Bun.Glob('apps/*/src/views/**/*');

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

    for (const app of apps) {
      expect(existsSync(resolve(root, `apps/${app}/src/views`)), app).toBe(
        false
      );
    }
  });

  test('application source does not import through the retired views alias', async () => {
    const imports = (await matchingFiles(appSourceGlob)).filter((path) => {
      const source = readFileSync(resolve(root, path), 'utf8');
      return /(?:from\s+|import\s*\()\s*['"][^'"]*(?:@\/views|\/views)(?:\/|['"])/m.test(
        source
      );
    });

    expect(imports).toEqual([]);
  });

  test('applications do not retain an ambiguous custom component layer', async () => {
    expect(await matchingFiles(customComponentGlob)).toEqual([]);

    for (const app of apps) {
      expect(
        existsSync(resolve(root, `apps/${app}/src/components/custom`)),
        app
      ).toBe(false);
    }
  });

  test('application source does not import through the retired custom alias', async () => {
    const imports = (await matchingFiles(appSourceGlob)).filter((path) => {
      const source = readFileSync(resolve(root, path), 'utf8');
      return /(?:from\s+|import\s*\()\s*['"][^'"]*(?:@\/components\/custom|\/components\/custom)(?:\/|['"])/m.test(
        source
      );
    });

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
