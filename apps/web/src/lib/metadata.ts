import type { Metadata } from 'next';

import { siteMetadataConfig } from '@/config/metadata.config';
import publicEnvConfig from '@/config/public.env.config';

interface PageMetadataInput {
  description: string;
  path: `/${string}` | '/';
  title: string;
}

export function createPageMetadata({
  description,
  path,
  title,
}: PageMetadataInput): Metadata {
  const url = new URL(path, publicEnvConfig.NEXT_PUBLIC_SITE_URL).toString();
  const image = new URL(
    siteMetadataConfig.socialImage.path,
    publicEnvConfig.NEXT_PUBLIC_SITE_URL
  ).toString();

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: { en: url },
    },
    openGraph: {
      title,
      description,
      url,
      siteName: 'SCS PDN',
      images: [
        {
          url: image,
          width: siteMetadataConfig.socialImage.width,
          height: siteMetadataConfig.socialImage.height,
          alt: siteMetadataConfig.socialImage.alt,
        },
      ],
      locale: 'en',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: [image],
      creator: 'SCS PDN',
    },
  };
}
