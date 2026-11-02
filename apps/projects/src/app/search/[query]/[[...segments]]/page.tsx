import { notFound } from 'next/navigation';

import { ProjectDirectory } from '@/components/projects/project-directory';
import { buildCollectionMetadata } from '@/lib/projects/collection-metadata';
import {
  canonicalizeSearchSegment,
  parseCollectionPage,
} from '@/lib/projects/collection-navigation';
import { requireProjectCollectionPage } from '@/lib/projects/route-data';

type PageProps = {
  params: Promise<{ query: string; segments?: string[] }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { query, segments } = await params;
  const normalizedQuery = canonicalizeSearchSegment(query);
  const page = parseCollectionPage(segments);
  if (!normalizedQuery || normalizedQuery !== query || page === null) return {};

  return buildCollectionMetadata(
    { kind: 'search', query: normalizedQuery },
    page
  );
}

export default async function SearchPage({ params }: PageProps) {
  const { query, segments } = await params;
  const normalizedQuery = canonicalizeSearchSegment(query);
  const page = parseCollectionPage(segments);
  if (!normalizedQuery || normalizedQuery !== query || page === null)
    notFound();
  const projects = await requireProjectCollectionPage(
    { kind: 'search', query: normalizedQuery },
    page
  );

  return (
    <ProjectDirectory
      collection={{ kind: 'search', query: normalizedQuery }}
      page={page}
      projects={projects}
    />
  );
}
