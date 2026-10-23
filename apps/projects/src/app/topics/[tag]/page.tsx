import type { Metadata } from 'next';

import ProjectCollection from '@/components/projects/project-collection';
import { labelFromSlug } from '@/lib/projects/metadata';

type PageProps = {
  params: Promise<{
    tag: string;
  }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { tag } = await params;
  const label = labelFromSlug(tag);

  return {
    title: `${label} Projects`,
    description: `Browse SCS projects connected to ${label}.`,
  };
}

export default async function Page({ params }: PageProps) {
  const { tag } = await params;
  const label = labelFromSlug(tag);

  return (
    <ProjectCollection
      eyebrow="Subject or technology"
      title={label}
      description="This subject can connect course work, research, systems, datasets, and student innovation."
      filters={{ tag }}
    />
  );
}
