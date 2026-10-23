import type { Metadata } from 'next';

import ProjectCollection from '@/components/projects/project-collection';
import { labelFromSlug } from '@/lib/projects/metadata';

type PageProps = {
  params: Promise<{
    category: string;
  }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { category } = await params;
  const label = labelFromSlug(category);

  return {
    title: `${label} Projects`,
    description: `Browse SCS projects in the ${label} collection.`,
  };
}

export default async function Page({ params }: PageProps) {
  const { category } = await params;
  const label = labelFromSlug(category);

  return (
    <ProjectCollection
      eyebrow="Collection"
      title={label}
      description="This collection can include course work, research, systems, datasets, collaborations, and student-led work."
      filters={{ category }}
    />
  );
}
