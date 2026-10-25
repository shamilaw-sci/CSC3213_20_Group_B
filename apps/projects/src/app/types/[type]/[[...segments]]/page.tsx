import { notFound } from 'next/navigation';

import { ProjectDirectory } from '@/components/projects/project-directory';
import {
  parseCollectionPage,
  resolveProjectTypeSegment,
} from '@/lib/projects/collection-navigation';

type PageProps = {
  params: Promise<{ type: string; segments?: string[] }>;
};

export default async function TypePage({ params }: PageProps) {
  const { type, segments } = await params;
  const projectType = resolveProjectTypeSegment(type);
  const page = parseCollectionPage(segments);
  if (!projectType || page === null) notFound();

  return (
    <ProjectDirectory collection={{ kind: 'type', projectType }} page={page} />
  );
}
