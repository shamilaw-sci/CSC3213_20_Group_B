import {
  buildDiscoveryUrl,
  deriveDiscoveryOptions,
  filterProjects,
  paginateProjects,
  parseProjectDiscoveryParams,
  patchProjectDiscoveryState,
  PROJECTS_PER_PAGE,
} from '@/lib/projects/discovery';
import type { Project } from '@/lib/projects/types';

function project(id: number, overrides: Partial<Project> = {}): Project {
  return {
    id: `project-${id}`,
    slug: `project-${id}`,
    title: `Project ${id}`,
    shortDescription: `Short description ${id}`,
    description: `Detailed description ${id}`,
    projectType: 'RESEARCH_PROJECT',
    status: 'ACTIVE',
    categories: ['research'],
    tags: ['Machine Learning'],
    departments: ['STATISTICS_AND_COMPUTER_SCIENCE'],
    academicYear: '2025/2026',
    people: [
      {
        name: 'Sivothayan S',
        role: 'student',
        username: 'e21sp001',
        email: 'e21sp001@eng.pdn.ac.lk',
        sNumber: 's21234',
      },
    ],
    links: { repository: `https://github.com/example/project-${id}` },
    source: {
      kind: 'GITHUB_REPO',
      repositoryOwner: 'example',
      repositoryName: `project-${id}`,
    },
    media: { icon: 'FolderKanban' },
    dates: { lastUpdatedAt: '2026-10-25' },
    ...overrides,
  };
}

describe('project discovery state', () => {
  test('parses canonical query parameters and normalizes their values', () => {
    const state = parseProjectDiscoveryParams(
      new URLSearchParams({
        q: '  neural search  ',
        category: 'Student Innovation',
        topic: 'Large Language Models',
        course: ' csc3213 ',
        status: 'active',
        type: 'research_project',
        person: ' E21SP001 ',
        page: '3',
      })
    );

    expect(state).toEqual({
      q: 'neural search',
      category: 'student-innovation',
      topic: 'large-language-models',
      course: 'CSC3213',
      status: 'ACTIVE',
      type: 'RESEARCH_PROJECT',
      person: 'e21sp001',
      page: 3,
    });
  });

  test('normalizes malformed and unknown parameters to safe defaults', () => {
    const state = parseProjectDiscoveryParams(
      new URLSearchParams({
        q: '   ',
        status: 'paused',
        type: 'thesis',
        page: '-4',
      })
    );

    expect(state).toEqual({
      q: '',
      category: '',
      topic: '',
      course: '',
      status: '',
      type: '',
      person: '',
      page: 1,
    });
  });

  test('combines full-text, facet, and exact-person filters', () => {
    const matching = project(1, {
      title: 'Neural Search for Course Projects',
      categories: ['student-innovation'],
      tags: ['Large Language Models'],
      course: {
        code: 'CSC3213',
        title: 'Software Systems Design Project',
        departments: ['STATISTICS_AND_COMPUTER_SCIENCE'],
      },
      people: [
        {
          name: 'Sivothayan S',
          role: 'student',
          username: 'e21sp001',
        },
      ],
    });
    const nearMatch = project(2, {
      title: 'Neural Search for Research',
      categories: ['research'],
      people: [
        {
          name: 'Another Student',
          role: 'student',
          username: 'e21sp002',
        },
      ],
    });
    const state = parseProjectDiscoveryParams(
      new URLSearchParams({
        q: 'neural search',
        category: 'student-innovation',
        topic: 'large-language-models',
        course: 'CSC3213',
        status: 'ACTIVE',
        type: 'RESEARCH_PROJECT',
        person: 'E21SP001',
      })
    );

    expect(filterProjects([nearMatch, matching], state)).toEqual([matching]);
  });

  test('searches project, person, and link fields', () => {
    const projects = [project(1)];

    for (const query of [
      'detailed description',
      'research project',
      'Sivothayan',
      'e21sp001',
      's21234',
      'github.com/example',
    ]) {
      const state = parseProjectDiscoveryParams(
        new URLSearchParams({ q: query })
      );
      expect(filterProjects(projects, state)).toHaveLength(1);
    }
  });

  test('paginates 12 projects and clamps invalid page requests', () => {
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

  test('derives deterministic options with counts from published projects', () => {
    const projects = [
      project(1, {
        categories: ['research', 'student-innovation'],
        tags: ['Machine Learning', 'Accessibility'],
        course: {
          code: 'CSC3213',
          title: 'Software Systems Design Project',
          departments: ['STATISTICS_AND_COMPUTER_SCIENCE'],
        },
      }),
      project(2, {
        categories: ['research'],
        tags: ['Accessibility'],
        status: 'COMPLETED',
        projectType: 'COURSE_PROJECT',
        course: {
          code: 'CSC2203',
          title: 'Programming Methodology',
          departments: ['STATISTICS_AND_COMPUTER_SCIENCE'],
        },
        courseOffering: { id: 'csc2203-2025-2026-sem1' },
        people: [
          {
            name: 'Another Student',
            role: 'student',
            username: 'e21sp002',
          },
        ],
      }),
    ];

    expect(deriveDiscoveryOptions(projects)).toEqual({
      categories: [
        { value: 'research', label: 'Research', count: 2 },
        {
          value: 'student-innovation',
          label: 'Student Innovation',
          count: 1,
        },
      ],
      topics: [
        { value: 'accessibility', label: 'Accessibility', count: 2 },
        { value: 'machine-learning', label: 'Machine Learning', count: 1 },
      ],
      courses: [
        {
          value: 'CSC2203',
          label: 'CSC2203 — Programming Methodology',
          count: 1,
        },
        {
          value: 'CSC3213',
          label: 'CSC3213 — Software Systems Design Project',
          count: 1,
        },
      ],
      people: [
        { value: 'e21sp001', label: 'Sivothayan S (@e21sp001)', count: 1 },
        {
          value: 'e21sp002',
          label: 'Another Student (@e21sp002)',
          count: 1,
        },
      ],
      statuses: [
        { value: 'ACTIVE', label: 'Active', count: 1 },
        { value: 'COMPLETED', label: 'Completed', count: 1 },
      ],
      types: [
        { value: 'COURSE_PROJECT', label: 'Course Project', count: 1 },
        { value: 'RESEARCH_PROJECT', label: 'Research Project', count: 1 },
      ],
    });
  });

  test('keeps Unicode and punctuation-only facets usable as select values', () => {
    const projects = [
      project(1, {
        categories: ['පර්යේෂණ'],
        tags: ['C++', 'தமிழ்'],
      }),
    ];

    const options = deriveDiscoveryOptions(projects);

    expect(options.categories[0]?.value).toBe('පර්යේෂණ');
    expect(options.topics.map((option) => option.value)).toEqual(
      expect.arrayContaining(['c++', 'தமிழ்'])
    );
    const punctuationTopic = options.topics.find(
      (option) => option.value === 'c++'
    );
    expect(
      filterProjects(
        projects,
        parseProjectDiscoveryParams(
          new URLSearchParams({ topic: punctuationTopic?.value ?? '' })
        )
      )
    ).toEqual(projects);
  });

  test('builds canonical URLs and resets pagination when filters change', () => {
    const initial = parseProjectDiscoveryParams(
      new URLSearchParams({ q: 'search', status: 'active', page: '4' })
    );
    const changed = patchProjectDiscoveryState(initial, {
      topic: 'Machine Learning',
    });

    expect(changed.page).toBe(1);
    expect(buildDiscoveryUrl(changed)).toBe(
      '/?q=search&topic=machine-learning&status=ACTIVE'
    );
    expect(
      buildDiscoveryUrl(patchProjectDiscoveryState(changed, { page: 2 }))
    ).toBe('/?q=search&topic=machine-learning&status=ACTIVE&page=2');
  });
});
