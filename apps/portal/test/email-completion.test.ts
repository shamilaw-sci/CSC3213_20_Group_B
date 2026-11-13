import { describe, expect, test } from 'bun:test';

import { emailCompletion, isStudentLocalPart } from '@/lib/email-completion';

describe('email completion', () => {
  test.each([
    ['s21513', '@sci.pdn.ac.lk'],
    ['S21SP513', '@sci.pdn.ac.lk'],
    ['s2151', ''],
    ['s215130', ''],
    ['s21sp51', ''],
    ['s21sp5130', ''],
    ['john', ''],
    ['', ''],
    ['john@', ''],
    ['john@s', 'ci.pdn.ac.lk'],
    ['john@sc', 'i.pdn.ac.lk'],
    ['john@SCI', '.pdn.ac.lk'],
    ['john@p', 'dn.ac.lk'],
    ['john@pd', 'n.ac.lk'],
    ['john@PDN', '.ac.lk'],
    ['john@pdn.ac.lk', ''],
    ['john@sci.pdn.ac.lk', ''],
    ['john@gmail.com', ''],
    ['s21513@p', 'dn.ac.lk'],
    ['john@x', ''],
    ['john@scix', ''],
    ['john@@p', ''],
    [' john@s', ''],
  ])('%s completes with %s', (value, suffix) => {
    expect(emailCompletion(value)).toBe(suffix);
  });

  test('recognizes only complete student local parts', () => {
    expect(isStudentLocalPart('s21513')).toBe(true);
    expect(isStudentLocalPart('S21SP513')).toBe(true);
    expect(isStudentLocalPart('s21sp51')).toBe(false);
    expect(isStudentLocalPart('s21513@pdn.ac.lk')).toBe(false);
  });
});
