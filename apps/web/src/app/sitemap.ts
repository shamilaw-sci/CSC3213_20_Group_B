import type { MetadataRoute } from 'next';

import publicEnvConfig from '@/config/public.env.config';

const siteUrl = publicEnvConfig.NEXT_PUBLIC_SITE_URL;
const lastModified = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    // Core Pages
    {
      url: siteUrl,
      lastModified,
      changeFrequency: 'yearly',
      priority: 1,
    },
    {
      url: `${siteUrl}/about-us`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/contact`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.9,
    },

    // Academic Content
    {
      url: `${siteUrl}/undergraduate-courses`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.8,
    },
    {
      url: `${siteUrl}/postgraduate-courses`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.8,
    },
    {
      url: `${siteUrl}/prizes-scholarships`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.7,
    },
    {
      url: `${siteUrl}/resources`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.4,
    },

    // Services & Community
    {
      url: `${siteUrl}/services`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${siteUrl}/societies`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.6,
    },

    // People
    {
      url: `${siteUrl}/people`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${siteUrl}/people/academic`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${siteUrl}/people/academic-support`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${siteUrl}/people/non-academic`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.3,
    },

    // Students
    {
      url: `${siteUrl}/people/students`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${siteUrl}/people/students/computer-science`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${siteUrl}/people/students/data-science`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${siteUrl}/people/students/statistics`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${siteUrl}/people/students/alumni`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ];
}
