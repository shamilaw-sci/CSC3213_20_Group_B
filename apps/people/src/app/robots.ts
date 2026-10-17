import type { MetadataRoute } from 'next';

import publicConfig from '@/config/public.env.config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/.well-known/'],
    },
    sitemap: [`${publicConfig.NEXT_PUBLIC_SITE_URL}/sitemap.xml`],
  };
}
