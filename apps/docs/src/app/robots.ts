import type { MetadataRoute } from 'next';

import { absoluteDocumentationUrl } from '@/lib/metadata';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: absoluteDocumentationUrl('/sitemap.xml'),
  };
}
