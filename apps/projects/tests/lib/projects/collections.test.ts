import type { Project } from '@scs/schemas';

import {
  deriveCollectionSummaries,
  filterProjectsByCollection,
  paginateProjects,
  PROJECTS_PER_PAGE,
  recentProjects,
} from '@/lib/projects/collections';

function project(id: number, overrides: Partial<Project> = {}): Project {
  return {
    id: `project-${id}`,
    slug: `project-${id}`,
    title: `Project ${id}`,
    shortDescription: `Short description ${id}`,
    description: `Detailed description ${id}`,
    projectType: 'RESEARCH_PROJECT',
    status: 'ACTIVE',
    categories: ['Research'],
    tags: ['Machine Learning'],
    departments: ['STATISTICS_AND_COMPUTER_SCIENCE'],
    people: [{ name: 'Student One', role: 'student', username: 'e21sp001' }],
    links: { repository: `https://github.com/example/project-${id}` },
    source: {
      kind: 'GITHUB_REPO',
      repositoryOwner: 'example',
      repositoryName: `project-${id}`,
    },
    media: { icon: 'FolderKanban' },
    dates: { lastUpdatedAt: '2026-10-20' },
    ...overrides,
  };
}

describe('project collections', () => {
  test('filters controlled types exactly', () => {
    const research = project(1);
    const system = project(2, { projectType: 'DEPARTMENT_SYSTEM' });

    expect(
      filterProjectsByCollection([system, research], {
        kind: 'type',
        projectType: 'RESEARCH_PROJECT',
      })
    ).toEqual([research]);
  });

  test('matches categories and topics through the shared canonical form', () => {
    const matching = project(1, {
      categories: ['Research / Systems'],
      tags: ['C++'],
    });
    const other = project(2, {
      categories: ['Student Innovation'],
      tags: ['Accessibility'],
    });

    expect(
      filterProjectsByCollection([other, matching], {
        kind: 'category',
        value: 'research systems',
      })
    ).toEqual([matching]);
    expect(
      filterProjectsByCollection([other, matching], {
        kind: 'topic',
        value: 'c++',
      })
    ).toEqual([matching]);
  });

  test('requires every normalized search term across published project fields', () => {
    const matching = project(1, {
      title: 'Neural Search',
      course: {
        code: 'CSC3213',
        title: 'Software Systems Design Project',
        departments: ['STATISTICS_AND_COMPUTER_SCIENCE'],
      },
      people: [{ name: 'Sivothayan S', role: 'student' }],
    });

    expect(
      filterProjectsByCollection([matching, project(2)], {
        kind: 'search',
        query: 'neural CSC3213 Sivothayan',
      })
    ).toEqual([matching]);
  });

  test('derives stable populated summaries and combines canonical collisions', () => {
    const summaries = deriveCollectionSummaries([
      project(1, {
        categories: ['Research Systems', 'research/systems'],
        tags: ['C++'],
      }),
      project(2, {
        projectType: 'DEPARTMENT_SYSTEM',
        categories: ['Ｒesearch   Systems'],
        tags: ['C++', 'Accessibility'],
      }),
    ]);

    expect(summaries.types).toEqual([
      {
        collection: { kind: 'type', projectType: 'RESEARCH_PROJECT' },
        label: 'Research Project',
        count: 1,
      },
      {
        collection: { kind: 'type', projectType: 'DEPARTMENT_SYSTEM' },
        label: 'Department System',
        count: 1,
      },
    ]);
    expect(summaries.categories).toEqual([
      {
        collection: { kind: 'category', value: 'research-systems' },
        label: 'Research Systems',
        count: 2,
      },
    ]);
    expect(summaries.topics).toEqual([
      {
        collection: { kind: 'topic', value: 'c++' },
        label: 'C++',
        count: 2,
      },
      {
        collection: { kind: 'topic', value: 'accessibility' },
        label: 'Accessibility',
        count: 1,
      },
    ]);
  });

  test('orders recent projects by required update date with a slug tie-breaker', () => {
    const projects = [
      project(1, { slug: 'z-last', dates: { lastUpdatedAt: '2026-10-24' } }),
      project(2, { slug: 'b-second', dates: { lastUpdatedAt: '2026-10-25' } }),
      project(3, { slug: 'a-first', dates: { lastUpdatedAt: '2026-10-25' } }),
    ];

    expect(recentProjects(projects, 2).map(({ slug }) => slug)).toEqual([
      'a-first',
      'b-second',
    ]);
    expect(projects.map(({ slug }) => slug)).toEqual([
      'z-last',
      'b-second',
      'a-first',
    ]);
  });

  test('paginates a bounded directory and clamps out-of-range pages', () => {
    const projects = Array.from({ length: 25 }, (_, index) =>
      project(index + 1)
    );

    expect(PROJECTS_PER_PAGE).toBe(12);
    expect(paginateProjects(projects, 2)).toMatchObject({
      page: 2,
      pageSize: 12,
      totalItems: 25,
      totalPages: 3,
    });
    expect(paginateProjects(projects, 2).projects).toHaveLength(12);
    expect(paginateProjects(projects, 99)).toMatchObject({
      page: 3,
      totalPages: 3,
    });
    expect(paginateProjects([], 0)).toEqual({
      projects: [],
      page: 1,
      pageSize: 12,
      totalItems: 0,
      totalPages: 1,
    });
  });
});
