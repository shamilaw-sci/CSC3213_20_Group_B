import { describe, expect, test } from 'bun:test';

import {
  candidateAggregatePathsForIdentity,
  removeProfile,
  publishedProfileMetadataFromProfile,
} from '@/repositories/public-profile.repo';
import { updatePublicProfileRequestSchema } from '@/schemas/request.schema';

const student = {
  title: 'Mr',
  fullName: 'Jane Student',
  registrationNo: 'S21513',
  studentType: 'UNDERGRADUATE',
  studentTrack: 'HONOURS',
  honoursProgramme: 'COMPUTER_SCIENCE',
  level: '4000',
  status: 'CURRENT',
};

const academic = {
  title: 'Dr',
  fullName: 'Jane Academic',
  email: 'jane@pdn.ac.lk',
  staffType: 'ACADEMIC_TEACHING',
  academicRank: 'LECTURER',
};

describe('public profile aggregate reconciliation helpers', () => {
  test('limits student aggregate candidates to student paths', () => {
    expect(candidateAggregatePathsForIdentity('s21513', 'student')).toEqual(
      expect.arrayContaining([
        'public/people/v2/students/s21.json',
        'public/people/v2/special/computer-science/s21.json',
        'public/people/v2/special/data-science/s21.json',
        'public/people/v2/special/statistics/s21.json',
        'public/people/v2/special/statistics-and-operations-research/s21.json',
      ])
    );
  });

  test('can list broad aggregate candidates when profile kind is unknown', () => {
    expect(candidateAggregatePathsForIdentity('s21513')).toEqual(
      expect.arrayContaining([
        'public/people/v2/staff/academic.json',
        'public/people/v2/staff/academic-support.json',
        'public/people/v2/staff/non-academic.json',
        'public/people/v2/students/s21.json',
      ])
    );
  });

  test('lists staff aggregate candidates for staff identities', () => {
    expect(candidateAggregatePathsForIdentity('jane')).toEqual(
      expect.arrayContaining([
        'public/people/v2/staff/academic.json',
        'public/people/v2/staff/academic-support.json',
        'public/people/v2/staff/non-academic.json',
        'public/people/v2/staff/statistics-and-computer-science/academic.json',
      ])
    );
  });

  test('removes matching student records without touching other records', () => {
    const otherStudent = { ...student, registrationNo: 'S21514' };

    expect(removeProfile([student, otherStudent], 's21513')).toEqual([
      otherStudent,
    ]);
  });

  test('removes matching staff records by email username', () => {
    const otherAcademic = { ...academic, email: 'other@pdn.ac.lk' };

    expect(removeProfile([academic, otherAcademic], 'jane')).toEqual([
      otherAcademic,
    ]);
  });

  test('accepts profile update paths that match kind and identity', () => {
    const result = updatePublicProfileRequestSchema.safeParse({
      username: 's21513',
      updatedBy: 'admin@pdn.ac.lk',
      profileKind: 'student',
      userPath: 'public/people/v2/users/s21513.json',
      aggregatePaths: [
        'public/people/v2/students/s21.json',
        'public/people/v2/special/computer-science/s21.json',
      ],
      profile: student,
    });

    expect(result.success).toBe(true);
  });

  test('rejects stale or mismatched profile update paths', () => {
    const result = updatePublicProfileRequestSchema.safeParse({
      username: 's21513',
      updatedBy: 'admin@pdn.ac.lk',
      profileKind: 'student',
      userPath: 'public/people/v2/users/s21513.json',
      aggregatePaths: [
        'public/people/v2/students/s21.json',
        'public/people/v2/special/computer-science/s21.json',
      ],
      profile: { ...student, studentTrack: 'GENERAL' },
    });

    expect(result.success).toBe(false);
  });

  test('rejects a special path that disagrees with the honours programme', () => {
    const result = updatePublicProfileRequestSchema.safeParse({
      username: 's21513',
      updatedBy: 'admin@pdn.ac.lk',
      profileKind: 'student',
      userPath: 'public/people/v2/users/s21513.json',
      aggregatePaths: [
        'public/people/v2/students/s21.json',
        'public/people/v2/special/data-science/s21.json',
      ],
      profile: student,
    });

    expect(result.success).toBe(false);
  });

  test('derives published special membership from the honours programme', () => {
    expect(
      publishedProfileMetadataFromProfile({
        username: 's21513',
        profile: student,
      })
    ).toEqual({
      profileKind: 'student',
      stream: 'computer-science',
      targetAggregateFiles: [
        'public/people/v2/students/s21.json',
        'public/people/v2/special/computer-science/s21.json',
      ],
    });
  });

  test('classifies published normal students without special membership', () => {
    expect(
      publishedProfileMetadataFromProfile({
        username: 's21513',
        profile: {
          ...student,
          studentTrack: 'GENERAL',
          honoursProgramme: undefined,
        },
      })
    ).toEqual({
      profileKind: 'student',
      targetAggregateFiles: ['public/people/v2/students/s21.json'],
    });
  });
});
