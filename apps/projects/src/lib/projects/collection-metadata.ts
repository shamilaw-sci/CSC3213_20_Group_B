import type { Metadata } from 'next';

import publicEnvConfig from '@/config/public.env.config';
import {
  buildCollectionPath,
  PROJECT_TYPE_SEGMENTS,
  type ProjectCollection,
} from '@/lib/projects/collection-navigation';
import { labelFromSlug } from '@/lib/projects/metadata';

function collectionLabel(collection: ProjectCollection) {
  switch (collection.kind) {
    case 'browse':
      return 'All Projects';
    case 'type':
      return labelFromSlug(PROJECT_TYPE_SEGMENTS[collection.projectType]);
    case 'category':
    case 'topic':
      return labelFromSlug(collection.value);
    case 'search':
      return `Search: ${collection.query.replaceAll('-', ' ')}`;
  }
}

export function buildCollectionMetadata(
  collection: ProjectCollection,
  page: number
): Metadata {
  const label = collectionLabel(collection);
  const title = page > 1 ? `${label} — Page ${page}` : label;
  const path = buildCollectionPath(collection, page);
  const canonicalUrl = new URL(path, publicEnvConfig.NEXT_PUBLIC_SITE_URL);
  const description =
    collection.kind === 'search'
      ? `Projects matching ${collection.query.replaceAll('-', ' ')}.`
      : `Browse ${label.toLowerCase()} from SCS at the University of Peradeniya.`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, url: canonicalUrl },
    ...(collection.kind === 'search'
      ? { robots: { index: false, follow: true } }
      : {}),
  };
}
