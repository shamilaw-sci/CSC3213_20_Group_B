import { metadata } from '@/app/layout';
import sitemap from '@/app/sitemap';
import { getAllProjects } from '@/lib/projects/queries';

vi.mock('next/font/google', () => ({
  Open_Sans: () => ({ variable: '--font-open-sans' }),
}));

vi.mock('@/lib/projects/queries', () => ({
  getAllProjects: vi.fn(),
  getCategories: vi.fn().mockResolvedValue([]),
  getCourses: vi.fn().mockResolvedValue([]),
  getTags: vi.fn().mockResolvedValue([]),
}));

const getAllProjectsMock = vi.mocked(getAllProjects);

describe('Projects canonical indexing', () => {
  test('indexes only home and canonical project detail routes', async () => {
    getAllProjectsMock.mockResolvedValue([
      {
        slug: 'clear-project',
        dates: { lastUpdatedAt: '2026-07-26' },
      },
    ] as Awaited<ReturnType<typeof getAllProjects>>);

    const entries = await sitemap();
    expect(entries.map((entry) => new URL(entry.url).pathname)).toEqual([
      '/',
      '/projects/clear-project',
    ]);
    expect(entries.some((entry) => entry.url.includes('/p/'))).toBe(false);
  });

  test('does not advertise feeds that the app does not publish', () => {
    expect(metadata.alternates).not.toHaveProperty('types');
  });
});
