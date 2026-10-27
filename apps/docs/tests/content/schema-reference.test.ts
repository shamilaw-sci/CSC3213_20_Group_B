import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import * as schemaExports from '@scs/schemas';
import { describe, expect, test } from 'vitest';

const repositoryRoot = resolve(process.cwd(), '../..');
const referenceRoot = join(repositoryRoot, 'docs/SCHEMA_REFERENCE');
const referencePages = [
  'ACADEMICS.md',
  'API_TRANSPORT.md',
  'COURSES.md',
  'PEOPLE.md',
  'PROJECTS.md',
  'RESEARCH.md',
] as const;

function publicSchemaExports(): string[] {
  return Object.keys(schemaExports)
    .filter((name) => name.endsWith('Schema') || name === 'createPageSchema')
    .sort();
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
