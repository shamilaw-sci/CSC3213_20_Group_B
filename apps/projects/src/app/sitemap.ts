import type { MetadataRoute } from 'next';

import publicEnvConfig from '@/config/public.env.config';
import {
  buildCollectionPath,
  type ProjectCollection,
} from '@/lib/projects/collection-navigation';
import {
  deriveCollectionSummaries,
  PROJECTS_PER_PAGE,
} from '@/lib/projects/collections';
import { getAllProjects } from '@/lib/projects/queries';

const siteUrl = publicEnvConfig.NEXT_PUBLIC_SITE_URL;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const projects = await getAllProjects();
  const summaries = deriveCollectionSummaries(projects);
  const collectionSummaries = [
    ...summaries.types,
    ...summaries.categories,
    ...summaries.topics,
  ];

  return [
    route('/', 'daily'),
    ...collectionRoutes({
      collection: { kind: 'browse' },
      count: projects.length,
    }),
    ...collectionSummaries.flatMap(collectionRoutes),
    ...projects.map((project) =>
      route(
        `/projects/${encodeURIComponent(project.slug)}`,
        'weekly',
        project.dates.lastUpdatedAt
      )
    ),
  ];
}

function collectionRoutes(summary: {
  collection: ProjectCollection;
  count: number;
}) {
  const totalPages = Math.ceil(summary.count / PROJECTS_PER_PAGE);

  return Array.from({ length: Math.max(1, totalPages) }, (_, index) =>
    route(buildCollectionPath(summary.collection, index + 1), 'weekly')
  );
}

function route(
  path: string,
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  lastModified?: string
): MetadataRoute.Sitemap[number] {
  return {
    url: `${siteUrl}${path}`,
    lastModified: lastModified ? new Date(lastModified) : new Date(),
    changeFrequency,
  };
}
