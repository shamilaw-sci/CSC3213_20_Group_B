import {
  AcademicDepartmentCodeSchema,
  AcademicRankSchema,
  AcademicSupportPositionSchema,
  AcademicSupportStaffSchema,
  AcademicTeachingStaffSchema,
  AcademicUnitCodeSchema,
  CourseOfferingSchema,
  CourseSchema,
  HonoursProgrammeCodeSchema,
  NonAcademicPositionSchema,
  NonAcademicStaffSchema,
  PersonSchema,
  PostgraduateProgrammeSchema,
  ProjectSchema,
  ProjectStatusSchema,
  ProjectTypeSchema,
  SemesterSchema,
  SlqfLevelSchema,
  StudentLevelSchema,
  StudentSchema,
  StudentStatusSchema,
  StudentTrackSchema,
  StudentTypeSchema,
} from '@scs/schemas';
import type { z } from 'zod';

export type PlaygroundKind =
  | 'student'
  | 'academic'
  | 'academic-support'
  | 'non-academic'
  | 'project'
  | 'course'
  | 'offering';

export type PlaygroundField = {
  key: string;
  label: string;
  kind?: 'text' | 'textarea' | 'number' | 'json';
  options?: readonly string[];
  hint?: string;
};

type PlaygroundDefinition = {
  label: string;
  description: string;
  schema: z.ZodType;
  initial: Record<string, unknown>;
  fields: PlaygroundField[];
};

const personFields: PlaygroundField[] = [
  { key: 'title', label: 'Title', options: PersonSchema.shape.title.options },
  { key: 'fullName', label: 'Full name' },
  { key: 'email', label: 'Public email' },
  { key: 'mobilePhone', label: 'Mobile phone' },
  {
    key: 'socialLinks',
    label: 'Social links',
    kind: 'json',
    hint: 'For example: {"urls":{"github":"https://github.com/name"}}',
  },
];

const staffFields: PlaygroundField[] = [
  ...personFields,
  {
    key: 'department',
    label: 'Department',
    options: AcademicDepartmentCodeSchema.options,
  },
  { key: 'unit', label: 'Unit', options: AcademicUnitCodeSchema.options },
  { key: 'officePhone', label: 'Office phone' },
];

export const playgroundDefinitions: Record<
  PlaygroundKind,
  PlaygroundDefinition
> = {
  student: {
    label: 'Student public profile',
    description:
      'One public student record. The registration number determines the file name.',
    schema: StudentSchema,
    initial: {
      title: 'Mr',
      fullName: '',
      registrationNo: '',
      studentType: 'UNDERGRADUATE',
      studentTrack: 'GENERAL',
      level: '1000',
      status: 'CURRENT',
    },
    fields: [
      ...personFields,
      { key: 'registrationNo', label: 'Registration number' },
      {
        key: 'studentType',
        label: 'Student type',
        options: StudentTypeSchema.options,
      },
      {
        key: 'studentTrack',
        label: 'Student track',
        options: StudentTrackSchema.options,
      },
      {
        key: 'level',
        label: 'Level',
        options: StudentLevelSchema.options,
      },
      { key: 'status', label: 'Status', options: StudentStatusSchema.options },
      {
        key: 'postgraduateProgramme',
        label: 'Postgraduate programme',
        options: PostgraduateProgrammeSchema.options,
      },
      {
        key: 'slqfLevel',
        label: 'SLQF level',
        options: SlqfLevelSchema.options,
      },
      {
        key: 'honoursProgramme',
        label: 'Honours programme',
        options: HonoursProgrammeCodeSchema.options,
      },
      {
        key: 'subjects',
        label: 'Subjects',
        kind: 'json',
        hint: 'JSON array of subject codes',
      },
      { key: 'personalEmail', label: 'Personal email' },
      {
        key: 'researchInterests',
        label: 'Research interests',
        kind: 'json',
        hint: 'JSON array of text',
      },
      { key: 'publications', label: 'Publications', kind: 'json' },
      { key: 'positions', label: 'Positions', kind: 'json' },
    ],
  },
  academic: {
    label: 'Academic teaching profile',
    description:
      'One public academic staff record. The public email determines the file name.',
    schema: AcademicTeachingStaffSchema,
    initial: {
      title: 'Dr',
      fullName: '',
      staffType: 'ACADEMIC_TEACHING',
      academicRank: 'LECTURER',
    },
    fields: [
      ...staffFields,
      {
        key: 'academicRank',
        label: 'Academic rank',
        options: AcademicRankSchema.options,
      },
      { key: 'officeLocation', label: 'Office location' },
      { key: 'website', label: 'Website' },
      { key: 'cvUrl', label: 'CV URL' },
      { key: 'qualifications', label: 'Qualifications', kind: 'json' },
      { key: 'positionsHeld', label: 'Positions held', kind: 'json' },
      { key: 'awards', label: 'Awards', kind: 'json' },
      { key: 'researchInterests', label: 'Research interests', kind: 'json' },
      { key: 'researchOngoing', label: 'Ongoing research', kind: 'json' },
      { key: 'publications', label: 'Publications', kind: 'json' },
      { key: 'keyPublications', label: 'Key publications', kind: 'json' },
      { key: 'conferencesAttended', label: 'Conferences', kind: 'json' },
      { key: 'teachings', label: 'Teaching course codes', kind: 'json' },
    ],
  },
  'academic-support': {
    label: 'Academic support profile',
    description: 'One public academic support staff record.',
    schema: AcademicSupportStaffSchema,
    initial: {
      title: 'Mr',
      fullName: '',
      staffType: 'ACADEMIC_SUPPORT',
      designation: 'PROGRAMMER',
    },
    fields: [
      ...staffFields,
      {
        key: 'designation',
        label: 'Designation',
        options: AcademicSupportPositionSchema.options,
      },
      {
        key: 'qualifications',
        label: 'Qualifications',
        kind: 'json',
        hint: 'JSON array of text',
      },
    ],
  },
  'non-academic': {
    label: 'Non-academic staff profile',
    description: 'One public non-academic staff record.',
    schema: NonAcademicStaffSchema,
    initial: {
      title: 'Mr',
      fullName: '',
      staffType: 'NON_ACADEMIC',
      designation: 'STAFF_ASSISTANT',
    },
    fields: [
      ...staffFields,
      {
        key: 'designation',
        label: 'Designation',
        options: NonAcademicPositionSchema.options,
      },
    ],
  },
  project: {
    label: 'Project',
    description:
      'One authoritative project record. The slug determines the file name.',
    schema: ProjectSchema,
    initial: {
      id: '',
      slug: '',
      title: '',
      shortDescription: '',
      description: '',
      projectType: 'OTHER',
      status: 'PLANNED',
      categories: [],
      tags: [],
      departments: [],
      people: [],
      links: {},
      source: { kind: 'MANUAL', curator: '' },
      media: { icon: 'FolderKanban' },
      dates: { lastUpdatedAt: '' },
    },
    fields: [
      { key: 'id', label: 'ID' },
      { key: 'slug', label: 'Slug' },
      { key: 'title', label: 'Title' },
      { key: 'shortDescription', label: 'Short description', kind: 'textarea' },
      { key: 'description', label: 'Description', kind: 'textarea' },
      {
        key: 'projectType',
        label: 'Project type',
        options: ProjectTypeSchema.options,
      },
      {
        key: 'status',
        label: 'Status',
        options: ProjectStatusSchema.options,
      },
      {
        key: 'categories',
        label: 'Categories',
        kind: 'json',
        hint: 'JSON array, for example ["coursework"]',
      },
      { key: 'tags', label: 'Tags', kind: 'json' },
      { key: 'departments', label: 'Departments', kind: 'json' },
      { key: 'academicYear', label: 'Academic year' },
      { key: 'course', label: 'Course context', kind: 'json' },
      { key: 'courseOffering', label: 'Course offering', kind: 'json' },
      { key: 'batch', label: 'Batch' },
      { key: 'groupNumber', label: 'Group number' },
      {
        key: 'people',
        label: 'People',
        kind: 'json',
        hint: 'JSON array, for example [{"name":"A Person","role":"contributor"}]',
      },
      { key: 'links', label: 'Links', kind: 'json' },
      { key: 'source', label: 'Source', kind: 'json' },
      { key: 'media', label: 'Media', kind: 'json' },
      { key: 'dates', label: 'Dates', kind: 'json' },
    ],
  },
  course: {
    label: 'Course',
    description:
      'One authoritative course file. The ID determines the file name.',
    schema: CourseSchema,
    initial: {
      id: '',
      primaryCode: '',
      codes: [],
      title: '',
      credits: 3,
      departments: [],
    },
    fields: [
      { key: 'id', label: 'ID' },
      { key: 'primaryCode', label: 'Primary code' },
      {
        key: 'codes',
        label: 'Course codes',
        kind: 'json',
        hint: 'JSON array including the primary code',
      },
      { key: 'title', label: 'Title' },
      {
        key: 'credits',
        label: 'Credits',
        options: ['1', '2', '3', '6'],
        kind: 'number',
      },
      { key: 'departments', label: 'Departments', kind: 'json' },
    ],
  },
  offering: {
    label: 'Course offering',
    description:
      'One authoritative offering file. The ID determines the file name.',
    schema: CourseOfferingSchema,
    initial: {
      id: '',
      courseId: '',
      academicYear: '',
      semester: 'SEM1',
      staff: [],
      departments: [],
    },
    fields: [
      { key: 'id', label: 'ID' },
      { key: 'courseId', label: 'Course ID' },
      { key: 'academicYear', label: 'Academic year' },
      { key: 'semester', label: 'Semester', options: SemesterSchema.options },
      {
        key: 'staff',
        label: 'Staff',
        kind: 'json',
        hint: 'JSON array of staff references and roles',
      },
      { key: 'departments', label: 'Departments', kind: 'json' },
    ],
  },
};

export function playgroundTarget(
  kind: PlaygroundKind,
  draft: Record<string, unknown>
): string | null {
  if (kind === 'course' || kind === 'offering') {
    const id = String(draft.id ?? '').trim();
    const directory = kind === 'course' ? 'courses' : 'offerings';
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)
      ? `public/academic/v2/${directory}/${id}.json`
      : null;
  }
  if (kind === 'project') {
    const slug = String(draft.slug ?? '').trim();
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
      ? `public/projects/v2/projects/${slug}.json`
      : null;
  }
  const username = String(
    kind === 'student'
      ? (draft.registrationNo ?? '')
      : String(draft.email ?? '').split('@')[0]
  )
    .trim()
    .toLowerCase();
  return /^[a-z][a-z0-9._]{2,29}$/.test(username)
    ? `public/people/v2/users/${username}.json`
    : null;
}

export function playgroundRecord(
  kind: PlaygroundKind,
  draft: Record<string, unknown>
) {
  return playgroundDefinitions[kind].schema.safeParse(draft);
}

export function playgroundRelatedFiles(
  kind: PlaygroundKind,
  draft: Record<string, unknown>
): string[] {
  if (kind === 'course') return ['public/academic/v2/courses.json'];
  if (kind === 'offering') return ['public/academic/v2/offerings.json'];
  if (kind === 'project') {
    const people = Array.isArray(draft.people) ? draft.people : [];
    const usernames = people.flatMap((person) => {
      if (typeof person !== 'object' || person === null) return [];
      const username = (person as Record<string, unknown>).username;
      return typeof username === 'string' &&
        /^[a-z][a-z0-9._]{2,29}$/.test(username.toLowerCase())
        ? [`public/projects/v2/by-person/${username.toLowerCase()}.json`]
        : [];
    });
    return [
      ...new Set([
        'public/projects/v2/projects.json',
        'public/projects/v2/manifest.json',
        ...usernames,
      ]),
    ];
  }
  const files = ['public/people/v2/search.json'];
  if (kind === 'student') {
    const match = /^S(\d{2})/i.exec(String(draft.registrationNo ?? ''));
    if (match) files.push(`public/people/v2/students/s${match[1]}.json`);
    files.push('public/people/v2/manifest.json');
    return files;
  }
  const staffKind = kind === 'academic' ? 'academic' : kind;
  files.push(`public/people/v2/staff/${staffKind}.json`);
  const department = String(draft.department ?? '')
    .toLowerCase()
    .replaceAll('_', '-');
  if (department)
    files.push(`public/people/v2/staff/${department}/${staffKind}.json`);
  return files;
}
