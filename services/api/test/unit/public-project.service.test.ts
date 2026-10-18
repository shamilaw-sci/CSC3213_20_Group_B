import { describe, expect, test } from 'bun:test';
import type { Project } from '@scs/schemas';

import {
  canUserSubmitProjectType,
  canUserEditProject,
  targetPathsForProject,
} from '@/services/public-project.service';

const baseProject = {
  id: 'prj-scholarship-management-system',
  slug: 'scholarship-management-system',
  title: 'Scholarship Management System',
  shortDescription: 'A workflow platform for scholarship applications.',
  description:
    'A workflow platform for scholarship applications, eligibility checks, review decisions, and student account linking.',
  projectType: 'COURSE_PROJECT',
  status: 'COMPLETED',
  categories: ['department-systems'],
  tags: ['scholarships'],
  departments: ['STATISTICS_AND_COMPUTER_SCIENCE'],
  academicYear: '2024/2025',
  course: {
    code: 'CSC3213',
    title: 'Software Engineering Project',
    departments: ['STATISTICS_AND_COMPUTER_SCIENCE'],
  },
  people: [
    {
      name: 'Student Name',
      role: 'student',
      email: 's21513@sci.pdn.ac.lk',
      username: 's21513',
      sNumber: 'S21513',
    },
  ],
  links: {},
  source: {
    kind: 'MANUAL',
    curator: 'SCS Projects Team',
  },
  media: {
    icon: 'FolderKanban',
  },
  dates: {
    lastUpdatedAt: '2026-07-24',
  },
} satisfies Project;

describe('public project service helpers', () => {
  test('derives data repo target paths for a project slug', () => {
    expect(targetPathsForProject('scholarship-management-system')).toEqual({
      projectPath:
        'public/projects/v2/projects/scholarship-management-system.json',
      aggregatePath: 'public/projects/v2/projects.json',
      manifestPath: 'public/projects/v2/manifest.json',
    });
  });

  test('allows listed project people to edit their project', () => {
    expect(
      canUserEditProject(
        { email: 's21513@sci.pdn.ac.lk', isSuperAdmin: false },
        baseProject
      )
    ).toBe(true);
  });

  test('allows super admins to edit any project', () => {
    expect(
      canUserEditProject(
        { email: 'admin@pdn.ac.lk', isSuperAdmin: true },
        baseProject
      )
    ).toBe(true);
  });

  test('rejects users who are not listed on the project', () => {
    expect(
      canUserEditProject(
        { email: 'other@sci.pdn.ac.lk', isSuperAdmin: false },
        baseProject
      )
    ).toBe(false);
  });

  test('limits non-admin users to user-submittable project types', () => {
    expect(
      canUserSubmitProjectType({ isSuperAdmin: false }, 'COURSE_PROJECT')
    ).toBe(true);
    expect(
      canUserSubmitProjectType({ isSuperAdmin: false }, 'DEPARTMENT_SYSTEM')
    ).toBe(false);
    expect(
      canUserSubmitProjectType({ isSuperAdmin: true }, 'DEPARTMENT_SYSTEM')
    ).toBe(true);
  });
});
