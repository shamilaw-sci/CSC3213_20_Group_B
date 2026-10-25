import { notFound } from 'next/navigation';

import { ProjectDirectory } from '@/components/projects/project-directory';
import { buildCollectionMetadata } from '@/lib/projects/collection-metadata';
import {
  canonicalizeCollectionSegment,
  parseCollectionPage,
} from '@/lib/projects/collection-navigation';

type PageProps = {
  params: Promise<{ category: string; segments?: string[] }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { category, segments } = await params;
  const value = canonicalizeCollectionSegment(category);
  const page = parseCollectionPage(segments);
  if (!value || value !== category || page === null) notFound();

  return buildCollectionMetadata({ kind: 'category', value }, page);
}

export default async function CategoryPage({ params }: PageProps) {
  const { category, segments } = await params;
  const value = canonicalizeCollectionSegment(category);
  const page = parseCollectionPage(segments);
  if (!value || value !== category || page === null) notFound();

  return (
    <ProjectDirectory collection={{ kind: 'category', value }} page={page} />
  );
}
