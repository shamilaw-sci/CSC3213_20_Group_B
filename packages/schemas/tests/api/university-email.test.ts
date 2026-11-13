import { describe, expect, test } from 'bun:test';

import {
  isUniversityEmailDomain,
  STUDENT_EMAIL_DOMAIN,
  UniversityEmailDomainSchema,
} from '#schemas/api/university-email.schema';

describe('university email domains', () => {
  test('exposes the two supported domains', () => {
    expect(UniversityEmailDomainSchema.options).toEqual([
      STUDENT_EMAIL_DOMAIN,
      'pdn.ac.lk',
    ]);
  });

  test.each([
    ['s21513@sci.pdn.ac.lk', true],
    ['staff@pdn.ac.lk', true],
    ['staff@PDN.AC.LK', true],
    ['staff@gmail.com', false],
    ['staff@', false],
    ['@pdn.ac.lk', false],
    ['staff@other@pdn.ac.lk', false],
  ])('%s allowed: %s', (email, allowed) => {
    expect(isUniversityEmailDomain(email)).toBe(allowed);
  });
});
