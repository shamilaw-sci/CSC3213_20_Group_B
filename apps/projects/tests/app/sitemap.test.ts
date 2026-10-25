import { metadata } from '@/app/layout';
import sitemap from '@/app/sitemap';
import { getAllProjects } from '@/lib/projects/queries';

vi.mock('next/font/google', () => ({
  Open_Sans: () => ({ variable: '--font-open-sans' }),
}));

vi.mock('@/lib/projects/queries', () => ({
  getAllProjects: vi.fn(),
}));

const getAllProjectsMock = vi.mocked(getAllProjects);

describe('Projects canonical indexing', () => {
  test('indexes populated path collections, required pages, and canonical details', async () => {
    getAllProjectsMock.mockResolvedValue(
      Array.from({ length: 13 }, (_, index) => ({
        id: `project-${index + 1}`,
        slug: `project-${index + 1}`,
        title: `Project ${index + 1}`,
        shortDescription: 'Short description',
        description: 'Detailed description',
        projectType: 'RESEARCH_PROJECT',
        status: 'ACTIVE',
        categories: ['Research'],
        tags: ['Accessibility'],
        departments: [],
        people: [{ name: 'Student', role: 'student' }],
        links: {},
        source: { kind: 'MANUAL', curator: 'SCS' },
        media: { icon: 'FolderKanban' },
        dates: { lastUpdatedAt: '2026-07-26' },
      })) as Awaited<ReturnType<typeof getAllProjects>>
    );

    const entries = await sitemap();
    const paths = entries.map((entry) => new URL(entry.url).pathname);
    expect(paths.slice(0, 8)).toEqual([
      '/',
      '/browse',
      '/browse/page/2',
      '/types/research-projects',
      '/types/research-projects/page/2',
      '/categories/research',
      '/categories/research/page/2',
      '/topics/accessibility',
    ]);
    expect(paths).toContain('/topics/accessibility/page/2');
    expect(paths).toContain('/projects/project-1');
    expect(paths).toContain('/projects/project-13');
    expect(entries.some((entry) => entry.url.includes('/p/'))).toBe(false);
    expect(entries.some((entry) => entry.url.includes('/search/'))).toBe(false);
    expect(entries.some((entry) => entry.url.includes('?'))).toBe(false);
  });

  test('does not advertise feeds that the app does not publish', () => {
    expect(metadata.alternates).not.toHaveProperty('types');
  });
});
