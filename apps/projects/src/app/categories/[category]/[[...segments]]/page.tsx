import { notFound } from 'next/navigation';

import { ProjectDirectory } from '@/components/projects/project-directory';
import { buildCollectionMetadata } from '@/lib/projects/collection-metadata';
import {
  canonicalizeCollectionSegment,
  parseCollectionPage,
} from '@/lib/projects/collection-navigation';
import { requireProjectCollectionPage } from '@/lib/projects/route-data';

type PageProps = {
  params: Promise<{ category: string; segments?: string[] }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { category, segments } = await params;
  const value = canonicalizeCollectionSegment(category);
  const page = parseCollectionPage(segments);
  if (!value || value !== category || page === null) return {};

  return buildCollectionMetadata({ kind: 'category', value }, page);
}

export default async function CategoryPage({ params }: PageProps) {
  const { category, segments } = await params;
  const value = canonicalizeCollectionSegment(category);
  const page = parseCollectionPage(segments);
  if (!value || value !== category || page === null) notFound();
  const projects = await requireProjectCollectionPage(
    { kind: 'category', value },
    page
  );

  return (
    <ProjectDirectory
      collection={{ kind: 'category', value }}
      page={page}
      projects={projects}
    />
  );
}
