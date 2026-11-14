import { describe, expect, test } from 'bun:test';

import {
  playgroundRelatedFiles,
  playgroundRecord,
  playgroundTarget,
} from '@/components/playground/playground-data';

describe('public data playground output', () => {
  test('locates an authoritative student file and validates its record', () => {
    const draft = {
      title: 'Mr',
      fullName: 'Example Student',
      registrationNo: 'S21513',
      studentType: 'UNDERGRADUATE',
      studentTrack: 'GENERAL',
      level: '3000',
      status: 'CURRENT',
    };
    expect(playgroundTarget('student', draft)).toBe(
      'public/people/v2/users/s21513.json'
    );
    expect(playgroundRecord('student', draft).success).toBe(true);
  });

  test('derives the staff file identity from its public email', () => {
    const draft = {
      email: 'staff123@sci.pdn.ac.lk',
      title: 'Mr',
      fullName: 'Example Staff',
      staffType: 'ACADEMIC_SUPPORT',
      designation: 'PROGRAMMER',
    };
    const parsed = playgroundRecord('academic-support', draft);
    expect(parsed.success).toBe(true);
    expect(playgroundTarget('academic-support', draft)).toBe(
      'public/people/v2/users/staff123.json'
    );
    expect(playgroundRelatedFiles('academic-support', draft)).toContain(
      'public/people/v2/staff/academic-support.json'
    );
  });

  test('uses individual academic files and identifies their generated collections', () => {
    expect(playgroundTarget('course', { id: 'software-engineering' })).toBe(
      'public/academic/v2/courses/software-engineering.json'
    );
    expect(playgroundTarget('offering', { id: 'csc3213-2025-2026-sem2' })).toBe(
      'public/academic/v2/offerings/csc3213-2025-2026-sem2.json'
    );
    expect(playgroundRelatedFiles('course', {})).toEqual([
      'public/academic/v2/courses.json',
    ]);
    expect(playgroundRelatedFiles('offering', {})).toEqual([
      'public/academic/v2/offerings.json',
    ]);
  });

  test('lists affected project and student projections', () => {
    expect(
      playgroundRelatedFiles('project', { people: [{ username: 's21513' }] })
    ).toContain('public/projects/v2/by-person/s21513.json');
    expect(
      playgroundRelatedFiles('student', { registrationNo: 'S21513' })
    ).toContain('public/people/v2/students/s21.json');
  });

  test('rejects unsafe project paths and invalid records', () => {
    expect(playgroundTarget('project', { slug: '../private' })).toBeNull();
    expect(playgroundRecord('project', { slug: 'example' }).success).toBe(
      false
    );
  });
});
