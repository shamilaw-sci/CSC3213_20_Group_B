import { expect, test } from 'bun:test';

import {
  normalizeOrcidIdentifier,
  OrcidUrlSchema,
} from '#schemas/people/orcid.schema';

test('normalizes checksum-valid ORCID identifiers, including X', () => {
  expect(normalizeOrcidIdentifier('0000-0002-1825-0097')).toBe(
    '0000-0002-1825-0097'
  );
  expect(
    normalizeOrcidIdentifier('https://orcid.org/0000-0002-1694-233X')
  ).toBe('0000-0002-1694-233X');
  expect(OrcidUrlSchema.parse('orcid.org/0000-0002-1825-0097')).toBe(
    'https://orcid.org/0000-0002-1825-0097'
  );
});

test('rejects malformed, spoofed, and checksum-invalid ORCID identifiers', () => {
  for (const value of [
    '0000-0002-1825-0098',
    'https://orcid.org.evil.test/0000-0002-1825-0097',
    'http://orcid.org/0000-0002-1825-0097',
    'https://orcid.org/0000-0002-1825-0097?verified=true',
    'https://orcid.org/0000-0002-1825-0097/other',
  ])
    expect(normalizeOrcidIdentifier(value)).toBeNull();
});
