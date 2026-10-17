import type { Metadata } from 'next';

import FacetIndex from '@/views/projects/FacetIndex';

export const metadata: Metadata = {
  title: 'Tags',
  description: 'Browse SCS projects by subject, technology, method, or domain.',
};

export default function Page() {
  return (
    <FacetIndex
      eyebrow="Directory"
      title="Subjects and technologies"
      description="Find work connected by subject, technology, method, data domain, or research theme."
      kind="tags"
    />
  );
}
