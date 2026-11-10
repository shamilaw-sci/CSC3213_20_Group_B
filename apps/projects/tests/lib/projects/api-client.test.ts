import { dataConfig } from '@/config/data.config';
import {
  clearProjectDataCacheForTests,
  fetchProjects,
} from '@/lib/projects/api-client';

const project = {
  id: 'prj-cache-test',
  slug: 'cache-test-project',
  title: 'Cache Test Project',
  shortDescription: 'A project used to verify cached project data fetches.',
  description: 'A project used to verify cached project data fetches.',
  projectType: 'COURSE_PROJECT',
  status: 'ACTIVE',
  categories: ['course-projects'],
  tags: ['Next.js', 'Cache'],
  departments: [],
  academicYear: '2025/2026',
  course: {
    courseId: 'software-systems-design-project',
    code: 'CSC3213',
    title: 'Software Systems Design Project',
    departments: [],
  },
  courseOffering: {
    id: 'csc3213-2025-2026-sem1',
  },
  people: [
    {
      name: 'Test Student',
      role: 'student',
    },
  ],
  links: {},
  source: {
    kind: 'GITHUB_REPO',
    repositoryOwner: 'csc3213-2026-group-b',
    repositoryName: 'cache-test-project',
  },
  media: {
    icon: 'FolderKanban',
  },
  dates: {
    lastUpdatedAt: '2026-07-26',
  },
};

describe('project API client cache', () => {
  beforeEach(() => {
    clearProjectDataCacheForTests();
    vi.restoreAllMocks();
  });

  test('deduplicates concurrent aggregate project data requests', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json([project])
    ) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    await Promise.all([fetchProjects(), fetchProjects(), fetchProjects()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://data.scs-pdn.space/projects/v2/projects.json'
    );
  });

  test('an expired rejection does not evict a newer response', async () => {
    const started = Date.now();
    const now = vi.spyOn(Date, 'now').mockReturnValue(started);
    let resolveFirst: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(async () => {
      if (fetchMock.mock.calls.length === 1) {
        return new Promise<Response>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Response.json([project]);
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const first = fetchProjects();
      now.mockReturnValue(started + dataConfig.cacheTtlMs + 1);
      expect(await fetchProjects()).toHaveLength(1);
      if (!resolveFirst) throw new Error('The first fetch was not started');
      resolveFirst(new Response(null, { status: 500 }));
      await expect(first).rejects.toThrow('Request failed');
      expect(await fetchProjects()).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      now.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
