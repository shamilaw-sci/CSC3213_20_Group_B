import { notFound } from 'next/navigation';

import { ProjectDirectory } from '@/components/projects/project-directory';
import { parseCollectionPage } from '@/lib/projects/collection-navigation';

type PageProps = {
  params: Promise<{ segments?: string[] }>;
};

export default async function BrowsePage({ params }: PageProps) {
  const { segments } = await params;
  const page = parseCollectionPage(segments);
  if (page === null) notFound();

  return <ProjectDirectory collection={{ kind: 'browse' }} page={page} />;
}
