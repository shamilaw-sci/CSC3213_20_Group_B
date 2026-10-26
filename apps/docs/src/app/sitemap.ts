import type { MetadataRoute } from 'next';

import { absoluteDocumentationUrl } from '@/lib/metadata';
import { source } from '@/lib/source';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['/', ...source.getPages().map((page) => page.url)].map((path) => ({
    url: absoluteDocumentationUrl(path),
    changeFrequency: 'weekly',
    priority: path === '/' ? 1 : 0.8,
  }));
}
