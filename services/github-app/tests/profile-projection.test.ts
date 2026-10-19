import { describe, expect, test } from 'bun:test';

import {
  profileIdentity,
  projectProfileMembership,
  searchEntryForProfile,
} from '@/domains/profiles/profile.projection';
import type { PublicProfile } from '@/domains/profiles/profile.types';

const student = {
  title: 'Ms',
  fullName: 'Jane Student',
  registrationNo: 'S21513',
  studentType: 'UNDERGRADUATE',
  studentTrack: 'HONOURS',
  level: '4000',
  status: 'CURRENT',
} satisfies PublicProfile;

describe('profile projections', () => {
  test('derives identity and search data from one authoritative profile', () => {
    expect(profileIdentity(student)).toBe('s21513');
    expect(searchEntryForProfile(student)).toMatchObject({
      id: 'student:s21513',
      identity: 's21513',
      href: '/people/s21513',
      name: 'Ms Jane Student',
      subtitle: 'Student',
    });
  });

  test('updates only the target membership without changing other records', () => {
    const other = { ...student, registrationNo: 'S21514' };
    expect(projectProfileMembership([other], student)).toEqual([
      other,
      student,
    ]);
    expect(projectProfileMembership([student, other], student)).toEqual([
      student,
      other,
    ]);
  });
});
