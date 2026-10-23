import type { Metadata } from 'next';

import FacetIndex from '@/components/projects/facet-index';

export const metadata: Metadata = {
  title: 'Collections',
  description: 'Browse SCS projects by collection.',
};

export default function Page() {
  return (
    <FacetIndex
      eyebrow="Directory"
      title="Project collections"
      description="Start with a familiar collection such as research, course projects, department systems, datasets, open source, or student innovation."
      kind="categories"
    />
  );
}
