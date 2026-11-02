import type { Project } from '@scs/schemas';

import { fetchProjects } from '@/lib/projects/api-client';
import { requireProjectCollectionPage } from '@/lib/projects/route-data';

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('next/navigation', () => ({ notFound }));
vi.mock('@/lib/projects/api-client', () => ({
  fetchProjects: vi.fn(),
}));

const fetchProjectsMock = vi.mocked(fetchProjects);
const publishedProject = {
  id: 'route-data-project',
  slug: 'route-data-project',
  title: 'Route Data Project',
  shortDescription: 'A project used to verify collection route handling.',
  description: 'A project used to verify collection route handling.',
  projectType: 'COURSE_PROJECT',
  status: 'ACTIVE',
  categories: ['Research Systems'],
  tags: ['TypeScript'],
  departments: [],
  people: [],
  links: {},
  source: {
    kind: 'GITHUB_REPO',
    repositoryOwner: 'csc3213-2026-group-b',
    repositoryName: 'route-data-project',
  },
  media: { icon: 'FolderKanban' },
  dates: { lastUpdatedAt: '2026-01-01' },
} satisfies Project;

describe('project collection route data', () => {
  beforeEach(() => {
    notFound.mockClear();
    fetchProjectsMock.mockResolvedValue([publishedProject]);
  });

  test('rejects category and topic paths absent from published data', async () => {
    await expect(
      requireProjectCollectionPage({ kind: 'category', value: 'missing' }, 1)
    ).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(
      requireProjectCollectionPage({ kind: 'topic', value: 'missing' }, 1)
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  test('rejects pages beyond the published result set', async () => {
    await expect(
      requireProjectCollectionPage({ kind: 'browse' }, 2)
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  test('returns projects for a valid collection page', async () => {
    await expect(
      requireProjectCollectionPage(
        { kind: 'category', value: 'research-systems' },
        1
      )
    ).resolves.toEqual([publishedProject]);
  });
});
