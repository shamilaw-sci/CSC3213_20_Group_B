import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

const repositoryRoot = resolve(process.cwd(), '../..');
const schemasRoot = join(repositoryRoot, 'packages/schemas/src/schemas');
const referenceRoot = join(repositoryRoot, 'docs/SCHEMA_REFERENCE');
const referencePages = [
  'ACADEMICS.md',
  'API_TRANSPORT.md',
  'COURSES.md',
  'PEOPLE.md',
  'PROJECTS.md',
  'RESEARCH.md',
] as const;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });
}

function publicSchemaExports(): string[] {
  const exports = sourceFiles(schemasRoot).flatMap((path) => {
    const source = readFileSync(path, 'utf8');
    return [...source.matchAll(/^export const (\w+Schema)\b/gm)].map(
      ([, name]) => name
    );
  });

  return [...exports, 'createPageSchema'].sort();
}

describe('schema reference', () => {
  test('catalogs every public runtime schema export exactly once', () => {
    const catalog = referencePages
      .map((page) => readFileSync(join(referenceRoot, page), 'utf8'))
      .join('\n');

    for (const name of publicSchemaExports()) {
      const occurrences = catalog.split(`\`${name}\``).length - 1;
      expect(occurrences, name).toBe(1);
    }
  });
});
