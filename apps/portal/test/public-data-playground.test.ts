import { describe, expect, test } from 'bun:test';

import {
  playgroundRelatedFiles,
  playgroundPublicPath,
  playgroundRecord,
  playgroundTarget,
} from '@/components/playground/playground-data';
import { preparePlaygroundFiles } from '@/components/playground/playground-files';
import { playgroundValidationIssues } from '@/components/playground/playground-validation';

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

  test('omits empty optional profile fields like the signed-in editor', () => {
    const parsed = playgroundRecord('academic', {
      title: 'Dr',
      fullName: 'Example Academic',
      email: 'example@sci.pdn.ac.lk',
      staffType: 'ACADEMIC_TEACHING',
      academicRank: 'LECTURER',
      website: '',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).not.toHaveProperty('website');
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

  test('locates only safe public records for optional preload', () => {
    expect(playgroundPublicPath('student', ' S21513 ')).toBe(
      'people/v2/users/s21513.json'
    );
    expect(playgroundPublicPath('project', 'example-project')).toBe(
      'projects/v2/projects/example-project.json'
    );
    expect(playgroundPublicPath('course', 'software-engineering')).toBe(
      'academic/v2/courses/software-engineering.json'
    );
    expect(playgroundPublicPath('offering', '../secret')).toBeNull();
  });

  test('lists affected project and student projections', () => {
    expect(
      playgroundRelatedFiles('project', { people: [{ username: 's21513' }] })
    ).toContain('public/projects/v2/by-person/s21513.json');
    expect(
      playgroundRelatedFiles('student', { registrationNo: 'S21513' })
    ).toContain('public/people/v2/students/s21.json');
  });

  test('includes old generated paths when a loaded record moves', () => {
    expect(
      playgroundRelatedFiles(
        'student',
        { registrationNo: 'S22513' },
        { registrationNo: 'S21513' }
      )
    ).toEqual([
      'public/people/v2/search.json',
      'public/people/v2/students/s22.json',
      'public/people/v2/students/s21.json',
      'public/people/v2/manifest.json',
    ]);
  });

  test('turns schema errors into linked plain-language instructions', () => {
    const invalid = playgroundRecord('student', {
      title: 'Mr',
      fullName: '',
      registrationNo: 'bad',
      studentType: 'UNDERGRADUATE',
      studentTrack: 'GENERAL',
      level: '3000',
      status: 'CURRENT',
    });
    expect(invalid.success).toBe(false);
    if (invalid.success) return;
    const result = playgroundValidationIssues('student', invalid.error.issues);
    expect(result.summary).toContainEqual({
      field: 'playground-field-fullName',
      message: 'Full name: Enter full name.',
    });
    expect(result.fields.some((item) => item.path === 'registrationNo')).toBe(
      true
    );
    expect(result.summary.map((item) => item.message).join(' ')).not.toContain(
      'Too small'
    );
  });

  test('prepares both course JSON files and gives an insertion position', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = Object.assign(async () => Response.json([]), {
      preconnect: originalFetch.preconnect,
    });
    try {
      const record = {
        id: 'new-course',
        primaryCode: 'CSC3213',
        codes: ['CSC3213'],
        title: 'Example',
        credits: 0,
        nonGpa: true,
        departments: [],
      };
      const files = await preparePlaygroundFiles({
        kind: 'course',
        record,
        published: null,
        target: 'public/academic/v2/courses/new-course.json',
        related: ['public/academic/v2/courses.json'],
        base: 'https://data.example.test',
      });
      expect(files).toHaveLength(2);
      expect(files[0]?.value).toMatchObject({ credits: 0, nonGpa: true });
      expect(files[1]?.value).toEqual([record]);
      expect(files[1]?.guidance).toContain('position 1');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('prepares project list, manifest, and person files from published projects', async () => {
    const originalFetch = globalThis.fetch;
    const published = {
      id: 'example',
      slug: 'example',
      title: 'Old title',
      shortDescription: 'Old summary',
      projectType: 'OTHER',
      status: 'ACTIVE',
      categories: ['work'],
      tags: [],
      people: [{ name: 'A Person', username: 'alice', role: 'contributor' }],
      dates: { lastUpdatedAt: '2026-11-14' },
    };
    globalThis.fetch = Object.assign(async () => Response.json([published]), {
      preconnect: originalFetch.preconnect,
    });
    try {
      const record = { ...published, title: 'New title' };
      const files = await preparePlaygroundFiles({
        kind: 'project',
        record,
        published,
        target: 'public/projects/v2/projects/example.json',
        related: [
          'public/projects/v2/projects.json',
          'public/projects/v2/manifest.json',
          'public/projects/v2/by-person/alice.json',
        ],
        base: 'https://data.example.test',
      });
      expect(files.map((file) => file.path)).toEqual([
        'public/projects/v2/projects/example.json',
        'public/projects/v2/projects.json',
        'public/projects/v2/manifest.json',
        'public/projects/v2/by-person/alice.json',
      ]);
      expect(files[1]?.value).toEqual([record]);
      expect(files[3]?.value).toMatchObject([{ title: 'New title' }]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('rejects unsafe project paths and invalid records', () => {
    expect(playgroundTarget('project', { slug: '../private' })).toBeNull();
    expect(playgroundRecord('project', { slug: 'example' }).success).toBe(
      false
    );
  });
});
