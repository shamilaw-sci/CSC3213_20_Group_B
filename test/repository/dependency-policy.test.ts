import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dependencySections = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
] as const;

interface PackageManifest {
  name?: string;
  packageManager?: string;
  private?: boolean;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

function getManifestFiles(): string[] {
  const files = ['package.json'];

  for (const workspaceRoot of ['apps', 'packages', 'services']) {
    for (const workspace of readdirSync(workspaceRoot, {
      withFileTypes: true,
    })) {
      if (workspace.isDirectory()) {
        files.push(join(workspaceRoot, workspace.name, 'package.json'));
      }
    }
  }

  return files;
}

function readManifest(file: string): PackageManifest {
  return JSON.parse(readFileSync(file, 'utf8')) as PackageManifest;
}

describe('workspace dependency policy', () => {
  test('uses one range for each external dependency across workspaces', () => {
    const ranges = new Map<string, Set<string>>();

    for (const file of getManifestFiles()) {
      const manifest = readManifest(file);

      for (const section of dependencySections) {
        for (const [dependency, range] of Object.entries(
          manifest[section] ?? {}
        )) {
          if (range.startsWith('workspace:')) continue;

          const dependencyRanges = ranges.get(dependency) ?? new Set<string>();
          dependencyRanges.add(range);
          ranges.set(dependency, dependencyRanges);
        }
      }
    }

    const drift = [...ranges]
      .filter(([, dependencyRanges]) => dependencyRanges.size > 1)
      .map(
        ([dependency, dependencyRanges]) =>
          `${dependency}: ${[...dependencyRanges].join(', ')}`
      );

    expect(drift).toEqual([]);
  });

  test('uses caret ranges for registry dependencies', () => {
    const invalidRanges: string[] = [];

    for (const file of getManifestFiles()) {
      const manifest = readManifest(file);

      for (const section of dependencySections) {
        for (const [dependency, range] of Object.entries(
          manifest[section] ?? {}
        )) {
          if (!range.startsWith('workspace:') && !range.startsWith('^')) {
            invalidRanges.push(`${file}:${section}:${dependency}:${range}`);
          }
        }
      }
    }

    expect(invalidRanges).toEqual([]);
  });

  test('keeps private workspace packages versionless', () => {
    const versionedPackages = getManifestFiles()
      .map((file) => ({ file, manifest: readManifest(file) }))
      .filter(({ manifest }) => manifest.private && manifest.version)
      .map(({ file, manifest }) => `${file}:${manifest.version}`);

    expect(versionedPackages).toEqual([]);
  });

  test('uses a node_modules layout that deployment packagers can resolve', () => {
    const bunfig = readFileSync('bunfig.toml', 'utf8');

    // The isolated linker stores packages under node_modules/.bun and links
    // them from each workspace. Vercel's Next.js packager does not follow those
    // links, which breaks the adapter's `next/setup-node-env` stub.
    expect(bunfig).toContain('linker = "hoisted"');
  });

  test('holds new releases for seven days with narrow compatibility exceptions', () => {
    const bunfig = readFileSync('bunfig.toml', 'utf8');

    expect(bunfig).toContain('minimumReleaseAge = 604800');
    expect(bunfig).toContain(
      'minimumReleaseAgeExcludes = ["@types/bun", "bun-types"]'
    );
  });

  test('keeps the Bun runtime pin aligned with the root manifest', () => {
    const manifest = readManifest('package.json');
    const bunVersion = readFileSync('.bun-version', 'utf8').trim();

    expect(manifest.packageManager).toBe(`bun@${bunVersion}`);
    expect(manifest.devDependencies?.['@types/bun']).toBe(`^${bunVersion}`);
  });
});
