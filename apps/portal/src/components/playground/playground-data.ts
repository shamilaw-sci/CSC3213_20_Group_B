import {
  AcademicSupportStaffSchema,
  AcademicTeachingStaffSchema,
  CourseOfferingSchema,
  CourseSchema,
  NonAcademicStaffSchema,
  ProjectSchema,
  StudentSchema,
} from '@scs/schemas';
import type { z } from 'zod';

import { pruneEmpty } from '@/components/editor/prune-empty';

export type PlaygroundKind =
  | 'student'
  | 'academic'
  | 'academic-support'
  | 'non-academic'
  | 'project'
  | 'course'
  | 'offering';

type Definition = {
  label: string;
  schema: z.ZodType;
  initial: Record<string, unknown>;
};

export const playgroundDefinitions: Record<PlaygroundKind, Definition> = {
  student: {
    label: 'Student public profile',
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
  },
  academic: {
    label: 'Academic teaching profile',
    schema: AcademicTeachingStaffSchema,
    initial: {
      title: 'Dr',
      fullName: '',
      email: '',
      staffType: 'ACADEMIC_TEACHING',
      academicRank: 'LECTURER',
    },
  },
  'academic-support': {
    label: 'Academic support profile',
    schema: AcademicSupportStaffSchema,
    initial: {
      title: 'Mr',
      fullName: '',
      email: '',
      staffType: 'ACADEMIC_SUPPORT',
      designation: 'PROGRAMMER',
    },
  },
  'non-academic': {
    label: 'Non-academic staff profile',
    schema: NonAcademicStaffSchema,
    initial: {
      title: 'Mr',
      fullName: '',
      email: '',
      staffType: 'NON_ACADEMIC',
      designation: 'STAFF_ASSISTANT',
    },
  },
  project: {
    label: 'Project',
    schema: ProjectSchema,
    initial: {
      id: 'new-project',
      slug: 'new-project',
      title: '',
      shortDescription: '',
      description: '',
      projectType: 'COURSE_PROJECT',
      status: 'PLANNED',
      departments: ['STATISTICS_AND_COMPUTER_SCIENCE'],
      categories: ['coursework'],
      tags: [],
      people: [{ name: '', role: 'student' }],
      links: {},
      source: { kind: 'MANUAL', curator: '' },
      media: {},
      dates: { lastUpdatedAt: '' },
    },
  },
  course: {
    label: 'Course',
    schema: CourseSchema,
    initial: {
      id: 'new-course',
      primaryCode: 'CSC3213',
      codes: ['CSC3213'],
      title: '',
      credits: 3,
      departments: ['STATISTICS_AND_COMPUTER_SCIENCE'],
    },
  },
  offering: {
    label: 'Course offering',
    schema: CourseOfferingSchema,
    initial: {
      id: 'new-offering',
      courseId: '',
      academicYear: '',
      semester: 'SEM1',
      staff: [],
      departments: [],
    },
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
  const profile =
    kind === 'student' ||
    kind === 'academic' ||
    kind === 'academic-support' ||
    kind === 'non-academic';
  return playgroundDefinitions[kind].schema.safeParse(
    profile ? pruneEmpty(draft) : draft
  );
}

export function playgroundPublicPath(
  kind: PlaygroundKind,
  identifier: string
): string | null {
  const id = identifier.trim().toLowerCase();
  if (
    kind === 'student' ||
    kind === 'academic' ||
    kind === 'academic-support' ||
    kind === 'non-academic'
  ) {
    return /^[a-z][a-z0-9._]{2,29}$/.test(id)
      ? `people/v2/users/${id}.json`
      : null;
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) return null;
  if (kind === 'project') return `projects/v2/projects/${id}.json`;
  return `academic/v2/${kind === 'course' ? 'courses' : 'offerings'}/${id}.json`;
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
