import type { Metadata } from 'next';
import { Suspense } from 'react';

import SearchPage from '@/app/search/_components/search-page';
import { ProjectListLoading } from '@/components/custom/StatePanel';

export const metadata: Metadata = {
  title: 'Search Projects',
  description:
    'Search SCS projects by title, course, people, technology, year, status, or collection.',
};

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 py-10">
          <ProjectListLoading />
        </main>
      }
    >
      <SearchPage />
    </Suspense>
  );
}
