import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import Home from '@/app/_components/home';
import { ProjectHomeLoading } from '@/components/projects/project-states';

const retiredDiscoveryKeys = new Set([
  'q',
  'category',
  'topic',
  'course',
  'status',
  'type',
  'person',
  'page',
]);

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const hasRetiredDiscoveryState = Object.keys(params).some((key) =>
    retiredDiscoveryKeys.has(key)
  );

  if (hasRetiredDiscoveryState) {
    const preservedParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (retiredDiscoveryKeys.has(key) || value === undefined) continue;
      for (const item of Array.isArray(value) ? value : [value]) {
        preservedParams.append(key, item);
      }
    }

    const query = preservedParams.toString();
    redirect(query ? `/?${query}` : '/');
  }

  return (
    <Suspense fallback={<ProjectHomeLoading />}>
      <Home />
    </Suspense>
  );
}
