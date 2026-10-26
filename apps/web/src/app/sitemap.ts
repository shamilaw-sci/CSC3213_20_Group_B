import type { MetadataRoute } from 'next';

import publicEnvConfig from '@/config/public.env.config';

const siteUrl = publicEnvConfig.NEXT_PUBLIC_SITE_URL;
const lastModified = new Date();

const contentRoutes = [
  { path: '', changeFrequency: 'yearly', priority: 1 },
  { path: '/about-us', changeFrequency: 'yearly', priority: 0.9 },
  { path: '/contact', changeFrequency: 'yearly', priority: 0.9 },
  {
    path: '/undergraduate-courses',
    changeFrequency: 'yearly',
    priority: 0.8,
  },
  {
    path: '/postgraduate-courses',
    changeFrequency: 'yearly',
    priority: 0.8,
  },
  {
    path: '/prizes-scholarships',
    changeFrequency: 'yearly',
    priority: 0.7,
  },
  { path: '/resources', changeFrequency: 'yearly', priority: 0.6 },
  { path: '/research', changeFrequency: 'yearly', priority: 0.8 },
  { path: '/services', changeFrequency: 'yearly', priority: 0.5 },
  { path: '/societies', changeFrequency: 'yearly', priority: 0.6 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return contentRoutes.map((route) => ({
    url: `${siteUrl}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
