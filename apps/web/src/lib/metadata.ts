import type { Metadata } from 'next';

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
  const image = `${publicEnvConfig.NEXT_PUBLIC_SITE_URL}/images/og.png`;

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
          width: 1200,
          height: 630,
          alt: 'Department of Statistics & Computer Science, University of Peradeniya',
        },
      ],
      locale: 'en',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
      creator: 'SCS PDN',
    },
  };
}
