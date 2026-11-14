import { describe, expect, test } from 'bun:test';

import {
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

  test('keeps staff file identity out of the copied JSON', () => {
    const parsed = playgroundRecord('academic-support', {
      _username: 'staff123',
      title: 'Mr',
      fullName: 'Example Staff',
      staffType: 'ACADEMIC_SUPPORT',
      designation: 'PROGRAMMER',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).not.toHaveProperty('_username');
    expect(
      playgroundTarget('academic-support', { _username: 'staff123' })
    ).toBe('public/people/v2/users/staff123.json');
  });

  test('uses collection files for courses and offerings', () => {
    expect(playgroundTarget('course', {})).toBe(
      'public/academic/v2/courses.json'
    );
    expect(playgroundTarget('offering', {})).toBe(
      'public/academic/v2/offerings.json'
    );
  });

  test('rejects unsafe project paths and invalid records', () => {
    expect(playgroundTarget('project', { slug: '../private' })).toBeNull();
    expect(playgroundRecord('project', { slug: 'example' }).success).toBe(
      false
    );
  });
});
