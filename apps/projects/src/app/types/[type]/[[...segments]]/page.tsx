import { notFound } from 'next/navigation';

import { ProjectDirectory } from '@/components/projects/project-directory';
import { buildCollectionMetadata } from '@/lib/projects/collection-metadata';
import {
  parseCollectionPage,
  resolveProjectTypeSegment,
} from '@/lib/projects/collection-navigation';
import { requireProjectCollectionPage } from '@/lib/projects/route-data';

type PageProps = {
  params: Promise<{ type: string; segments?: string[] }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { type, segments } = await params;
  const projectType = resolveProjectTypeSegment(type);
  const page = parseCollectionPage(segments);
  if (!projectType || page === null) return {};

  return buildCollectionMetadata({ kind: 'type', projectType }, page);
}

export default async function TypePage({ params }: PageProps) {
  const { type, segments } = await params;
  const projectType = resolveProjectTypeSegment(type);
  const page = parseCollectionPage(segments);
  if (!projectType || page === null) notFound();
  const projects = await requireProjectCollectionPage(
    { kind: 'type', projectType },
    page
  );

  return (
    <ProjectDirectory
      collection={{ kind: 'type', projectType }}
      page={page}
      projects={projects}
    />
  );
}
