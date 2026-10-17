import type { MetadataRoute } from 'next';

import publicEnvConfig from '@/config/public.env.config';
import {
  getAllProjects,
  getCategories,
  getCourses,
  getTags,
} from '@/lib/projects/queries';

const siteUrl = publicEnvConfig.NEXT_PUBLIC_SITE_URL;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [projects, categories, tags, courses] = await Promise.all([
    getAllProjects(),
    getCategories(),
    getTags(),
    getCourses(),
  ]);

  return [
    route('/', 'daily'),
    route('/search', 'weekly'),
    route('/categories', 'weekly'),
    route('/topics', 'weekly'),
    route('/courses', 'weekly'),
    ...projects.map((project) =>
      route(`/projects/${project.slug}`, 'weekly', project.dates.lastUpdatedAt)
    ),
    ...categories.map((category) =>
      route(`/categories/${category.slug}`, 'weekly')
    ),
    ...tags.map((tag) => route(`/topics/${tag.slug}`, 'weekly')),
    ...courses.map((course) =>
      route(`/courses/${course.code}/projects`, 'weekly')
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
