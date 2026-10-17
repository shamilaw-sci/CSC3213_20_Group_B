import type { MetadataRoute } from 'next';

import publicEnvConfig from '@/config/public.env.config';
import { getSubjectPath, SUBJECTS } from '@/config/subjects';

const siteUrl = publicEnvConfig.NEXT_PUBLIC_SITE_URL;
const lastModified = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  const subjectRoutes = SUBJECTS.map((subject) => ({
    url: `${siteUrl}${getSubjectPath(subject.slug)}`,
    lastModified,
    changeFrequency: 'monthly' as const,
    priority: 0.9,
  }));

  return [
    {
      url: siteUrl,
      lastModified,
      changeFrequency: 'yearly',
      priority: 1,
    },
    {
      url: `${siteUrl}/staff`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/staff/academic`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/staff/academic-support`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${siteUrl}/staff/non-academic`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.1,
    },
    {
      url: `${siteUrl}/students`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    ...subjectRoutes,
  ];
}
