import {
  canManageStudentHonours,
  defaultRoleForEmail,
  interpretJevSuggestion,
  parseStudentIdentifier,
  resolveRole,
  validateRoleAssignment,
} from '@scs/identity';
import { expect, test } from 'bun:test';

test('classifies only exact institutional student patterns', () => {
  for (const email of [
    's21513@sci.pdn.ac.lk',
    'S21SP345@SCI.PDN.AC.LK',
    's19420@sci.pdn.ac.lk',
  ]) {
    expect(defaultRoleForEmail(email)).toBe('STUDENT');
    expect(parseStudentIdentifier(email)).not.toBeNull();
  }
  for (const email of [
    'shamilaw@sci.pdn.ac.lk',
    'unknown@sci.pdn.ac.lk',
    's21513@gmail.com',
    's21513@sci.pdn.ac.lk.evil.test',
  ]) {
    expect(defaultRoleForEmail(email)).toBe('OTHER');
  }
});

test('Jev cannot promote an account on insufficient or unsupported evidence', () => {
  expect(interpretJevSuggestion({ choice: 'insufficient' })).toEqual({
    kind: 'insufficient_evidence',
  });
  expect(
    interpretJevSuggestion({ choice: 'SUPER_ADMIN', confidence: 1 })
  ).toEqual({ kind: 'unsupported_classification' });
});

test('locks student role before any approved override', () => {
  expect(() =>
    validateRoleAssignment('s21513@sci.pdn.ac.lk', 'ACADEMIC')
  ).toThrow();
  expect(
    resolveRole({
      email: 's21513@sci.pdn.ac.lk',
      approvedMapping: 'ACADEMIC',
    })
  ).toEqual({ role: 'STUDENT', source: 'STUDENT_PATTERN' });
  expect(
    resolveRole({
      email: 'staff@sci.pdn.ac.lk',
      currentRole: 'OTHER',
      approvedMapping: 'ACADEMIC',
    }).role
  ).toBe('ACADEMIC');
});

test('HOD scope needs a matching programme and student department evidence', () => {
  const departments = ['STATISTICS_AND_COMPUTER_SCIENCE'] as const;
  expect(
    canManageStudentHonours({
      departments,
      programme: 'STATISTICS',
      student: { subjects: ['COMPUTER_SCIENCE', 'STATISTICS'] },
    })
  ).toBe(true);
  expect(
    canManageStudentHonours({
      departments,
      programme: 'STATISTICS',
      student: {},
    })
  ).toBe(false);
  expect(
    canManageStudentHonours({
      departments,
      programme: 'STATISTICS',
      student: { subjects: ['CHEMISTRY', 'PHYSICS'] },
    })
  ).toBe(false);
  expect(
    canManageStudentHonours({
      departments,
      programme: 'CHEMISTRY',
      student: { subjects: ['COMPUTER_SCIENCE', 'STATISTICS'] },
    })
  ).toBe(false);
  expect(
    canManageStudentHonours({
      departments,
      programme: 'STATISTICS',
      student: { honoursProgramme: 'CHEMISTRY' },
    })
  ).toBe(false);
});
