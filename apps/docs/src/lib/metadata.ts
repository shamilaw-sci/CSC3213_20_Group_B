import type { Metadata } from 'next';

import { siteConfig } from '@/config/site.config';

type DocumentationMetadata = {
  description?: string;
  title: string;
  url: string;
};

export function absoluteDocumentationUrl(path: string): string {
  return new URL(path, siteConfig.origin).toString();
}

export function createDocumentationMetadata({
  description,
  title,
  url,
}: DocumentationMetadata): Metadata {
  const canonical = absoluteDocumentationUrl(url);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      title,
      description,
      url: canonical,
      siteName: siteConfig.name,
    },
  };
}

export function getDocumentationSourceUrl(path: string): string {
  const encodedPath = path
    .replaceAll('\\', '/')
    .split('/')
    .map(encodeURIComponent)
    .join('/');

  return `${siteConfig.repositoryUrl}/blob/main/docs/${encodedPath}`;
}
