import { describe, expect, test } from 'bun:test';
import type { Project } from '@scs/schemas';

import {
  hasProjectInAggregate,
  hasProjectInManifest,
  removeProjectFromAggregate,
  removeProjectManifest,
  upsertProjectManifest,
} from '@/domains/projects/project.projection';
import {
  deletePublicProjectRequestSchema,
  updatePublicProjectRequestSchema,
} from '@scs/schemas';

const project = {
  id: 'prj-scholarship-management-system',
  slug: 'scholarship-management-system',
  title: 'Scholarship Management System',
  shortDescription: 'A workflow platform for scholarship applications.',
  description:
    'A workflow platform for scholarship applications, eligibility checks, review decisions, and student account linking.',
  projectType: 'COURSE_PROJECT',
  status: 'COMPLETED',
  categories: ['department-systems'],
  tags: ['scholarships', 'workflow'],
  departments: ['STATISTICS_AND_COMPUTER_SCIENCE'],
  academicYear: '2024/2025',
  course: {
    courseId: 'software-engineering-project',
    offeringId: 'software-engineering-project-2024-2025-sem2',
    code: 'CSC3213',
    title: 'Software Engineering Project',
    academicYear: '2024/2025',
    semester: 'SEM2',
    departments: ['STATISTICS_AND_COMPUTER_SCIENCE'],
  },
  courseOffering: {
    id: 'software-engineering-project-2024-2025-sem2',
  },
  people: [
    {
      name: 'Student Name',
      role: 'student',
    },
  ],
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
  links: {},
} satisfies Project;

describe('public project reconciliation helpers', () => {
  test('accepts project update paths that match the project slug', () => {
    const result = updatePublicProjectRequestSchema.safeParse({
      slug: 'scholarship-management-system',
      updatedBy: 'admin@pdn.ac.lk',
      updatedByType: 'admin',
      projectPath:
        'public/projects/v2/projects/scholarship-management-system.json',
      aggregatePath: 'public/projects/v2/projects.json',
      manifestPath: 'public/projects/v2/manifest.json',
      expectedHeadSha: '0123456789abcdef0123456789abcdef01234567',
      project,
    });

    expect(result.success).toBe(true);
  });

  test('allows only an admin to rename through the original project path', () => {
    const request = {
      slug: 'scholarship-management-system',
      updatedBy: 'admin@pdn.ac.lk',
      projectPath:
        'public/projects/v2/projects/scholarship-management-system.json',
      aggregatePath: 'public/projects/v2/projects.json',
      manifestPath: 'public/projects/v2/manifest.json',
      project: { ...project, slug: 'renamed-scholarship-system' },
    };
    expect(
      updatePublicProjectRequestSchema.safeParse({
        ...request,
        updatedByType: 'admin',
      }).success
    ).toBeTrue();
    expect(
      updatePublicProjectRequestSchema.safeParse({
        ...request,
        updatedByType: 'owner',
      }).success
    ).toBeFalse();
  });

  test('rejects project update paths that do not match the project slug', () => {
    const result = updatePublicProjectRequestSchema.safeParse({
      slug: 'wrong-project',
      updatedBy: 'admin@pdn.ac.lk',
      projectPath:
        'public/projects/v2/projects/scholarship-management-system.json',
      aggregatePath: 'public/projects/v2/projects.json',
      manifestPath: 'public/projects/v2/manifest.json',
      project,
    });

    expect(result.success).toBe(false);
  });

  test('rejects invalid project update expected head shas', () => {
    const result = updatePublicProjectRequestSchema.safeParse({
      slug: 'scholarship-management-system',
      updatedBy: 'admin@pdn.ac.lk',
      updatedByType: 'admin',
      projectPath:
        'public/projects/v2/projects/scholarship-management-system.json',
      aggregatePath: 'public/projects/v2/projects.json',
      manifestPath: 'public/projects/v2/manifest.json',
      expectedHeadSha: 'not-a-sha',
      project,
    });

    expect(result.success).toBe(false);
  });

  test('accepts project delete paths that match the project slug', () => {
    const result = deletePublicProjectRequestSchema.safeParse({
      slug: 'scholarship-management-system',
      updatedBy: 'admin@pdn.ac.lk',
      updatedByType: 'admin',
      projectPath:
        'public/projects/v2/projects/scholarship-management-system.json',
      aggregatePath: 'public/projects/v2/projects.json',
      manifestPath: 'public/projects/v2/manifest.json',
      expectedHeadSha: '0123456789abcdef0123456789abcdef01234567',
    });

    expect(result.success).toBe(true);
  });

  test('removes project aggregate entries by slug', () => {
    const nextProjects = removeProjectFromAggregate(
      [
        project,
        {
          ...project,
          id: 'prj-kept-project',
          slug: 'kept-project',
          title: 'Kept Project',
        },
      ],
      'scholarship-management-system'
    );

    expect(nextProjects).toEqual([
      {
        ...project,
        id: 'prj-kept-project',
        slug: 'kept-project',
        title: 'Kept Project',
      },
    ]);
  });

  test('keeps project aggregate deletion idempotent when slug is absent', () => {
    const keptProject = {
      ...project,
      id: 'prj-kept-project',
      slug: 'kept-project',
      title: 'Kept Project',
    };

    expect(
      removeProjectFromAggregate([keptProject], 'scholarship-management-system')
    ).toEqual([keptProject]);
  });

  test('detects whether project aggregate contains a slug', () => {
    expect(
      hasProjectInAggregate([project], 'scholarship-management-system')
    ).toBe(true);
    expect(hasProjectInAggregate([project], 'missing-project')).toBe(false);
    expect(hasProjectInAggregate({}, 'scholarship-management-system')).toBe(
      false
    );
  });

  test('upserts project manifest entries by slug', () => {
    const nextManifest = upsertProjectManifest(
      {
        version: '1',
        projects: [
          {
            id: 'old-id',
            slug: 'scholarship-management-system',
            title: 'Old title',
            href: 'projects/scholarship-management-system.json',
          },
        ],
      },
      project,
      '2026-07-24T00:00:00.000Z'
    );

    expect(nextManifest).toEqual({
      version: '1',
      updatedAt: '2026-07-24T00:00:00.000Z',
      projects: [
        {
          id: 'prj-scholarship-management-system',
          slug: 'scholarship-management-system',
          title: 'Scholarship Management System',
          href: 'projects/scholarship-management-system.json',
        },
      ],
    });
  });

  test('detects whether project manifest contains a slug', () => {
    const manifest = {
      version: 'v1',
      projects: [
        {
          id: 'prj-scholarship-management-system',
          slug: 'scholarship-management-system',
          title: 'Scholarship Management System',
          href: 'projects/scholarship-management-system.json',
        },
      ],
    };

    expect(
      hasProjectInManifest(manifest, 'scholarship-management-system')
    ).toBe(true);
    expect(hasProjectInManifest(manifest, 'missing-project')).toBe(false);
    expect(hasProjectInManifest([], 'scholarship-management-system')).toBe(
      false
    );
  });

  test('keeps project manifest updatedAt absent when it was absent', () => {
    const nextManifest = removeProjectManifest(
      {
        version: 'v1',
        projects: [
          {
            id: 'old-id',
            slug: 'scholarship-management-system',
            title: 'Old title',
            href: 'projects/scholarship-management-system.json',
          },
        ],
      },
      'scholarship-management-system'
    );

    expect(nextManifest).toEqual({
      version: 'v1',
      projects: [],
    });
  });

  test('removes project manifest entries by slug', () => {
    const nextManifest = removeProjectManifest(
      {
        version: '1',
        projects: [
          {
            id: 'old-id',
            slug: 'scholarship-management-system',
            title: 'Old title',
            href: 'projects/scholarship-management-system.json',
          },
          {
            id: 'kept-id',
            slug: 'kept-project',
            title: 'Kept Project',
            href: 'projects/kept-project.json',
          },
        ],
      },
      'scholarship-management-system',
      '2026-07-24T00:00:00.000Z'
    );

    expect(nextManifest).toEqual({
      version: '1',
      updatedAt: '2026-07-24T00:00:00.000Z',
      projects: [
        {
          id: 'kept-id',
          slug: 'kept-project',
          title: 'Kept Project',
          href: 'projects/kept-project.json',
        },
      ],
    });
  });
});
