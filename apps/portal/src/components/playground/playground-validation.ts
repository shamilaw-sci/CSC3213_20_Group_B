import type { z } from 'zod';

import type { EditorValidationIssue } from '@/components/editor/editor-state';
import {
  type FieldIssue,
  validationFieldId,
} from '@/components/editor/field-validation';
import type { PlaygroundKind } from '@/components/playground/playground-data';

const fieldLabels: Record<string, string> = {
  academicYear: 'Academic year',
  academicRank: 'Academic rank',
  courseId: 'Course ID',
  cvUrl: 'CV URL',
  fullName: 'Full name',
  primaryCode: 'Primary code',
  registrationNo: 'Registration number',
  shortDescription: 'Short description',
  slqfLevel: 'SLQF level',
};

const directFields: Record<PlaygroundKind, readonly string[]> = {
  student: [
    'title',
    'fullName',
    'email',
    'mobilePhone',
    'registrationNo',
    'personalEmail',
    'studentType',
    'studentTrack',
    'level',
    'honoursProgramme',
    'postgraduateProgramme',
    'slqfLevel',
    'status',
  ],
  academic: [
    'title',
    'fullName',
    'email',
    'mobilePhone',
    'department',
    'unit',
    'academicRank',
    'officePhone',
    'officeLocation',
    'website',
    'cvUrl',
  ],
  'academic-support': [
    'title',
    'fullName',
    'email',
    'mobilePhone',
    'department',
    'unit',
    'designation',
    'officePhone',
  ],
  'non-academic': [
    'title',
    'fullName',
    'email',
    'mobilePhone',
    'department',
    'unit',
    'designation',
    'officePhone',
  ],
  project: [
    'title',
    'slug',
    'id',
    'status',
    'shortDescription',
    'description',
    'projectType',
    'academicYear',
  ],
  course: ['id', 'title', 'credits', 'primaryCode'],
  offering: ['courseId', 'id', 'academicYear', 'semester'],
};

function labelFor(segment: string) {
  return (
    fieldLabels[segment] ??
    segment
      .replaceAll(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^./, (letter) => letter.toUpperCase())
  );
}

function friendlyMessage(issue: z.core.$ZodIssue, label: string) {
  if (label === 'Credits') return 'Enter a whole number from 0 to 10.';
  if (issue.code === 'too_small' && issue.minimum === 1)
    return issue.origin === 'array'
      ? `Add at least one entry to ${label.toLowerCase()}.`
      : `Enter ${label.toLowerCase()}.`;
  if (issue.code === 'invalid_type')
    return issue.expected === 'string'
      ? `Enter ${label.toLowerCase()}.`
      : issue.expected === 'array'
        ? `Add ${label.toLowerCase()}.`
        : `Choose ${label.toLowerCase()}.`;
  if (issue.code === 'invalid_value')
    return `Choose a listed ${label.toLowerCase()}.`;
  if (issue.code === 'too_small')
    return `Add more detail to ${label.toLowerCase()}.`;
  if (issue.code === 'too_big') return `Shorten ${label.toLowerCase()}.`;
  if (issue.message.includes('Invalid URL'))
    return 'Enter a full URL beginning with https://.';
  if (issue.message.includes('Invalid email'))
    return 'Enter a valid email address.';
  if (issue.message.includes('Academic year must be'))
    return 'Use a year range such as 2025/2026.';
  if (issue.message.includes('Invalid ISO date'))
    return 'Use a date such as 2025-11-14.';
  if (issue.message.includes('ending year must immediately follow'))
    return 'The second year must be the year after the first.';
  if (
    issue.message === 'Invalid course id' ||
    issue.message === 'Invalid project slug' ||
    issue.message === 'Invalid course offering id'
  )
    return 'Use lowercase letters, numbers, and hyphens.';
  if (issue.message === 'Invalid course code')
    return 'Use a course code such as CSC3213.';
  if (issue.message.startsWith('Invalid S-Number format'))
    return 'Use a registration number such as S21513 or S21SP513.';
  if (issue.message.includes('primaryCode must be listed in codes'))
    return 'Add the primary code to the course code list.';
  if (issue.message.includes('course.courseId is required'))
    return 'Select a course for this course project.';
  if (issue.message.includes('must not contain duplicates'))
    return 'Remove repeated choices.';
  return issue.message;
}

function sectionFor(kind: PlaygroundKind, root: string) {
  if (kind === 'project') {
    if (root === 'people') return 'project-people';
    if (
      [
        'course',
        'courseOffering',
        'projectType',
        'departments',
        'academicYear',
        'batch',
        'groupNumber',
        'categories',
        'tags',
      ].includes(root)
    )
      return 'project-academic';
    if (root === 'links') return 'project-links';
    if (root === 'source') return 'project-source';
    return 'project-title';
  }
  if (kind === 'course') {
    if (['codes', 'primaryCode'].includes(root)) return 'course-codes';
    if (root === 'departments') return 'course-departments';
    return 'course-details';
  }
  if (kind === 'offering') return 'editor-title';
  if (['socialLinks', 'website', 'cvUrl'].includes(root))
    return 'profile-links';
  if (
    [
      'positions',
      'positionsHeld',
      'qualifications',
      'awards',
      'researchOngoing',
      'researchInterests',
      'teachings',
    ].includes(root)
  )
    return 'profile-work';
  if (
    ['title', 'fullName', 'email', 'mobilePhone', 'personalEmail'].includes(
      root
    )
  )
    return 'profile-about';
  return 'profile-role';
}

export function playgroundValidationIssues(
  kind: PlaygroundKind,
  issues: readonly z.core.$ZodIssue[]
): {
  fields: FieldIssue[];
  summary: EditorValidationIssue[];
} {
  const fields: FieldIssue[] = [];
  const seen = new Set<string>();
  const summary = issues.flatMap((issue) => {
    const path = issue.path.map(String);
    const pathKey = path.join('.');
    if (seen.has(pathKey)) return [];
    seen.add(pathKey);
    const root = path[0] ?? '';
    const courseChoice =
      kind === 'project' &&
      issue.message.includes('course.courseId is required');
    const label = courseChoice
      ? 'Course'
      : path.length
        ? path
            .map((segment) =>
              /^\d+$/.test(segment)
                ? `item ${Number(segment) + 1}`
                : labelFor(segment)
            )
            .join(' · ')
        : 'Record';
    const message = friendlyMessage(issue, labelFor(path.at(-1) ?? 'record'));
    const direct =
      (path.length === 1 && directFields[kind].includes(root)) ||
      (kind === 'project' &&
        ((path.length === 3 &&
          root === 'people' &&
          ['name', 'email', 'sNumber'].includes(path[2] ?? '')) ||
          (path.length === 2 &&
            root === 'course' &&
            ['courseId', 'code', 'title'].includes(path[1] ?? '')) ||
          (path.length === 2 && root === 'links')));
    if (direct) fields.push({ path: pathKey, message });
    return {
      field: direct
        ? validationFieldId(pathKey)
        : courseChoice
          ? 'project-academic'
          : sectionFor(kind, root),
      message: `${label}: ${message}`,
    };
  });
  return { fields, summary };
}
