import { ProjectSchema } from '@scs/schemas';

import { resolveProjectRepositoryMetadata } from '@/lib/projects/repository-metadata';

const project = ProjectSchema.parse({
  id: 'registry-id',
  slug: 'registry-slug',
  title: 'Registry title',
  shortDescription: 'Registry summary',
  description: 'Registry description',
  projectType: 'OTHER',
  status: 'ACTIVE',
  categories: ['software'],
  tags: [],
  people: [{ name: 'Registry person', role: 'maintainer' }],
  links: {},
  source: {
    kind: 'TEMPLATE_INDEX_JSON',
    repositoryOwner: 'scs-pdn',
    repositoryName: 'example',
    metadataPath: '.docs/index.json',
    indexUrl:
      'https://api.github.com/repos/scs-pdn/example/contents/.docs/index.json',
  },
  media: {},
  dates: { lastUpdatedAt: '2026-11-03' },
});

describe('repository index metadata', () => {
  afterEach(() => vi.unstubAllGlobals());

  test('applies repository fields while preserving registry ID and slug', async () => {
    const content = Buffer.from(
      JSON.stringify({
        $schema: 'https://api.scs-pdn.space/api/projects/v2/schemas/index.json',
        title: 'Repository title',
        people: [{ name: 'Repository person', role: 'contributor' }],
      })
    ).toString('base64');
    const fetchMock = vi.fn(async (_url: string | URL) =>
      Response.json({ content })
    );
    vi.stubGlobal('fetch', fetchMock);

    const resolved = await resolveProjectRepositoryMetadata(project);
    expect(resolved).toMatchObject({
      id: 'registry-id',
      slug: 'registry-slug',
      title: 'Repository title',
      people: [{ name: 'Repository person' }],
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.github.com/repos/scs-pdn/example/contents/.docs/index.json'
    );
  });

  test('uses published values when repository index is invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          content: Buffer.from(JSON.stringify({ slug: 'forged' })).toString(
            'base64'
          ),
        })
      )
    );
    expect(await resolveProjectRepositoryMetadata(project)).toEqual(project);
  });
});
