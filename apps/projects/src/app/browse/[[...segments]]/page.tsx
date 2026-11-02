import { notFound } from 'next/navigation';

import { ProjectDirectory } from '@/components/projects/project-directory';
import { buildCollectionMetadata } from '@/lib/projects/collection-metadata';
import { parseCollectionPage } from '@/lib/projects/collection-navigation';
import { requireProjectCollectionPage } from '@/lib/projects/route-data';

type PageProps = {
  params: Promise<{ segments?: string[] }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { segments } = await params;
  const page = parseCollectionPage(segments);
  if (page === null) return {};

  return buildCollectionMetadata({ kind: 'browse' }, page);
}

export default async function BrowsePage({ params }: PageProps) {
  const { segments } = await params;
  const page = parseCollectionPage(segments);
  if (page === null) notFound();
  const projects = await requireProjectCollectionPage({ kind: 'browse' }, page);

  return (
    <ProjectDirectory
      collection={{ kind: 'browse' }}
      page={page}
      projects={projects}
    />
  );
}
