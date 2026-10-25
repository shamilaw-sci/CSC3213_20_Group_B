import { buildCollectionMetadata } from '@/lib/projects/collection-metadata';

describe('project collection metadata', () => {
  test('publishes a distinct canonical URL for every collection page', () => {
    const metadata = buildCollectionMetadata(
      { kind: 'type', projectType: 'RESEARCH_PROJECT' },
      2
    );

    expect(metadata.title).toBe('Research Projects — Page 2');
    expect(metadata.alternates?.canonical?.toString()).toBe(
      'https://projects.scs-pdn.space/types/research-projects/page/2'
    );
    expect(metadata.openGraph?.url?.toString()).toBe(
      'https://projects.scs-pdn.space/types/research-projects/page/2'
    );
  });

  test('keeps search canonical but excludes it from indexing', () => {
    const metadata = buildCollectionMetadata(
      { kind: 'search', query: 'accessible-data' },
      1
    );

    expect(metadata.title).toBe('Search: accessible data');
    expect(metadata.alternates?.canonical?.toString()).toBe(
      'https://projects.scs-pdn.space/search/accessible-data'
    );
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
});
