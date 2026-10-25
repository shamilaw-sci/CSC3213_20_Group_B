import { notFound } from 'next/navigation';

import { ProjectDirectory } from '@/components/projects/project-directory';
import {
  canonicalizeCollectionSegment,
  parseCollectionPage,
} from '@/lib/projects/collection-navigation';

type PageProps = {
  params: Promise<{ topic: string; segments?: string[] }>;
};

export default async function TopicPage({ params }: PageProps) {
  const { topic, segments } = await params;
  const value = canonicalizeCollectionSegment(topic);
  const page = parseCollectionPage(segments);
  if (!value || value !== topic || page === null) notFound();

  return <ProjectDirectory collection={{ kind: 'topic', value }} page={page} />;
}
