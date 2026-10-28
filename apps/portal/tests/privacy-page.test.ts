import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = readFileSync(
  resolve(import.meta.dir, '../src/app/privacy/page.tsx'),
  'utf8'
);

describe('Portal privacy and security reporting policy', () => {
  test('publishes one linkable policy for bugs and security reports', () => {
    expect(pageSource).toContain('id="security-reporting"');
    expect(pageSource).toContain('Report a bug or security issue');
    expect(pageSource).toContain('security vulnerability');
    expect(pageSource).toContain('general software bug');
    expect(pageSource).toContain('mailto:s21513@sci.pdn.ac.lk');
    expect(pageSource).toContain(
      'https://portal.scs-pdn.space/privacy#security-reporting'
    );
  });
});
