import { notFound } from 'next/navigation';

import { ProjectDirectory } from '@/components/projects/project-directory';
import {
  canonicalizeSearchSegment,
  parseCollectionPage,
} from '@/lib/projects/collection-navigation';

type PageProps = {
  params: Promise<{ query: string; segments?: string[] }>;
};

export default async function SearchPage({ params }: PageProps) {
  const { query, segments } = await params;
  const normalizedQuery = canonicalizeSearchSegment(query);
  const page = parseCollectionPage(segments);
  if (!normalizedQuery || normalizedQuery !== query || page === null)
    notFound();

  return (
    <ProjectDirectory
      collection={{ kind: 'search', query: normalizedQuery }}
      page={page}
    />
  );
}
