import { describe, expect, test } from 'bun:test';
import type { Project } from '@scs/schemas';

import { publicAcademicPaths } from '@/repositories/public-course.repo';
import { updatePublicProjectRequestSchema } from '@/schemas/request.schema';

const project = {
  id: 'prj-example',
  slug: 'example',
  title: 'Example Project',
  shortDescription: 'An example project.',
  description: 'An example project used to characterize concurrent writes.',
  projectType: 'OTHER',
  status: 'ACTIVE',
  categories: ['example'],
  tags: ['example'],
  departments: ['STATISTICS_AND_COMPUTER_SCIENCE'],
  people: [{ name: 'Example Person', role: 'contributor' }],
  links: {},
  source: { kind: 'MANUAL', curator: 'SCS' },
  media: { icon: 'FolderKanban' },
  dates: { lastUpdatedAt: '2026-10-19' },
} satisfies Project;

function projectRequest(projectValue = project) {
  return {
    slug: projectValue.slug,
    updatedBy: 'admin@pdn.ac.lk',
    updatedByType: 'admin' as const,
    projectPath: `public/projects/v2/projects/${projectValue.slug}.json`,
    aggregatePath: 'public/projects/v2/projects.json',
    manifestPath: 'public/projects/v2/manifest.json',
    project: projectValue,
  };
}

describe('concurrent mutation risk characterization', () => {
  test('duplicate deliveries have no durable operation identity', () => {
    const first = updatePublicProjectRequestSchema.parse(projectRequest());
    const replay = updatePublicProjectRequestSchema.parse(projectRequest());

    expect(first).toEqual(replay);
    expect(first).not.toHaveProperty('operationId');
    expect(first).not.toHaveProperty('idempotencyKey');
  });

  test('the initial same-entity write contract permits no expected head SHA', () => {
    const firstEditor =
      updatePublicProjectRequestSchema.safeParse(projectRequest());
    const staleEditor = updatePublicProjectRequestSchema.safeParse(
      projectRequest({ ...project, title: 'Stale Editor Title' })
    );

    expect(firstEditor.success).toBe(true);
    expect(staleEditor.success).toBe(true);
    if (firstEditor.success && staleEditor.success) {
      expect(firstEditor.data.expectedHeadSha).toBeUndefined();
      expect(staleEditor.data.expectedHeadSha).toBeUndefined();
    }
  });

  test('unrelated projects share aggregate and manifest collision domains', () => {
    const first = projectRequest({
      ...project,
      id: 'prj-first-project',
      slug: 'first-project',
    });
    const second = projectRequest({
      ...project,
      id: 'prj-second-project',
      slug: 'second-project',
    });

    expect(first.projectPath).not.toBe(second.projectPath);
    expect(first.aggregatePath).toBe(second.aggregatePath);
    expect(first.manifestPath).toBe(second.manifestPath);
  });

  test('unrelated academic records share one aggregate per registry kind', () => {
    expect(publicAcademicPaths.courseRecord('first')).not.toBe(
      publicAcademicPaths.courseRecord('second')
    );
    expect(publicAcademicPaths.courseAggregate).toBe(
      'public/academic/v2/courses.json'
    );
    expect(publicAcademicPaths.offeringAggregate).toBe(
      'public/academic/v2/offerings.json'
    );
  });
});
