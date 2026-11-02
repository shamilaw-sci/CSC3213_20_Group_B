import type { ProjectType } from '@scs/schemas';

import BrowsePage from '@/app/browse/[[...segments]]/page';
import CategoryPage from '@/app/categories/[category]/[[...segments]]/page';
import SearchPage from '@/app/search/[query]/[[...segments]]/page';
import TopicPage from '@/app/topics/[topic]/[[...segments]]/page';
import TypePage from '@/app/types/[type]/[[...segments]]/page';
import { ProjectDirectory } from '@/components/projects/project-directory';
import { PROJECT_TYPE_SEGMENTS } from '@/lib/projects/collection-navigation';

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));
const { requireProjectCollectionPage } = vi.hoisted(() => ({
  requireProjectCollectionPage: vi.fn(async () => []),
}));

vi.mock('next/navigation', () => ({
  notFound,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/projects/route-data', () => ({
  requireProjectCollectionPage,
}));

describe('project collection route adapters', () => {
  beforeEach(() => {
    notFound.mockClear();
    requireProjectCollectionPage.mockClear();
  });

  test('resolves browse base and paginated paths', async () => {
    const base = await BrowsePage({ params: Promise.resolve({}) });
    const second = await BrowsePage({
      params: Promise.resolve({ segments: ['page', '2'] }),
    });

    expect(base.type).toBe(ProjectDirectory);
    expect(base.props).toEqual({
      collection: { kind: 'browse' },
      page: 1,
      projects: [],
    });
    expect(second.props).toEqual({
      collection: { kind: 'browse' },
      page: 2,
      projects: [],
    });
  });

  test('resolves every controlled project type segment', async () => {
    for (const [projectType, type] of Object.entries(PROJECT_TYPE_SEGMENTS) as [
      ProjectType,
      string,
    ][]) {
      const element = await TypePage({
        params: Promise.resolve({ type, segments: ['page', '2'] }),
      });

      expect(element.props).toEqual({
        collection: { kind: 'type', projectType },
        page: 2,
        projects: [],
      });
    }
  });

  test('resolves canonical category, topic, and search descriptors', async () => {
    const category = await CategoryPage({
      params: Promise.resolve({ category: 'research', segments: undefined }),
    });
    const topic = await TopicPage({
      params: Promise.resolve({ topic: 'c++', segments: ['page', '3'] }),
    });
    const search = await SearchPage({
      params: Promise.resolve({ query: 'c#', segments: undefined }),
    });

    expect(category.props).toEqual({
      collection: { kind: 'category', value: 'research' },
      page: 1,
      projects: [],
    });
    expect(topic.props).toEqual({
      collection: { kind: 'topic', value: 'c++' },
      page: 3,
      projects: [],
    });
    expect(search.props).toEqual({
      collection: { kind: 'search', query: 'c#' },
      page: 1,
      projects: [],
    });
  });

  test('rejects malformed pages, unknown types, and noncanonical segments', async () => {
    const calls = [
      () =>
        BrowsePage({
          params: Promise.resolve({ segments: ['page', '0'] }),
        }),
      () =>
        TypePage({
          params: Promise.resolve({ type: 'unknown', segments: undefined }),
        }),
      () =>
        CategoryPage({
          params: Promise.resolve({
            category: 'Research Systems',
            segments: undefined,
          }),
        }),
      () =>
        SearchPage({
          params: Promise.resolve({ query: '', segments: undefined }),
        }),
    ];

    for (const call of calls) {
      await expect(call()).rejects.toThrow('NEXT_NOT_FOUND');
    }
    expect(notFound).toHaveBeenCalledTimes(calls.length);
  });
});
