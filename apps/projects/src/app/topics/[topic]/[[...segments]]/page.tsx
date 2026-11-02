import { notFound } from 'next/navigation';

import { ProjectDirectory } from '@/components/projects/project-directory';
import { buildCollectionMetadata } from '@/lib/projects/collection-metadata';
import {
  canonicalizeCollectionSegment,
  parseCollectionPage,
} from '@/lib/projects/collection-navigation';
import { requireProjectCollectionPage } from '@/lib/projects/route-data';

type PageProps = {
  params: Promise<{ topic: string; segments?: string[] }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { topic, segments } = await params;
  const value = canonicalizeCollectionSegment(topic);
  const page = parseCollectionPage(segments);
  if (!value || value !== topic || page === null) return {};

  return buildCollectionMetadata({ kind: 'topic', value }, page);
}

export default async function TopicPage({ params }: PageProps) {
  const { topic, segments } = await params;
  const value = canonicalizeCollectionSegment(topic);
  const page = parseCollectionPage(segments);
  if (!value || value !== topic || page === null) notFound();
  const projects = await requireProjectCollectionPage(
    { kind: 'topic', value },
    page
  );

  return (
    <ProjectDirectory
      collection={{ kind: 'topic', value }}
      page={page}
      projects={projects}
    />
  );
}
