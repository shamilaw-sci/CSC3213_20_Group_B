import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const version = process.env.SCHEMAS_VERSION?.trim();

if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error('SCHEMAS_VERSION must be a valid release version');
}

const packageRoot = path.resolve(import.meta.dirname, '..');
const outputRoot = path.join(packageRoot, 'package');
const manifest = {
  name: '@csc3213-2026-group-b/scs-schemas',
  version,
  description: 'Canonical SCS PDN runtime and transport schemas',
  license: 'AGPL-3.0',
  type: 'module',
  sideEffects: false,
  files: ['dist'],
  exports: {
    '.': {
      types: './dist/index.d.ts',
      import: './dist/index.js',
      default: './dist/index.js',
    },
  },
  imports: {
    '#schemas/*': {
      types: './dist/schemas/*.d.ts',
      import: './dist/schemas/*.js',
      default: './dist/schemas/*.js',
    },
  },
  repository: {
    type: 'git',
    url: 'git+https://github.com/csc3213-2026-group-b/scs-pdn-monorepo.git',
    directory: 'packages/schemas',
  },
  publishConfig: {
    access: 'restricted',
    registry: 'https://npm.pkg.github.com',
  },
  dependencies: {
    zod: '^4.4.3',
  },
};

await rm(outputRoot, { force: true, recursive: true });
await mkdir(outputRoot, { recursive: true });
await cp(path.join(packageRoot, 'dist'), path.join(outputRoot, 'dist'), {
  recursive: true,
});
await writeFile(
  path.join(outputRoot, 'package.json'),
  `${JSON.stringify(manifest, null, 2)}\n`
);

console.log(`Prepared ${manifest.name}@${version}`);
