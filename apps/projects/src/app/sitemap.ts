import type { MetadataRoute } from 'next';

import publicEnvConfig from '@/config/public.env.config';
import { getAllProjects } from '@/lib/projects/queries';

const siteUrl = publicEnvConfig.NEXT_PUBLIC_SITE_URL;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const projects = await getAllProjects();

  return [
    route('/', 'daily'),
    ...projects.map((project) =>
      route(
        `/projects/${encodeURIComponent(project.slug)}`,
        'weekly',
        project.dates.lastUpdatedAt
      )
    ),
  ];
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
