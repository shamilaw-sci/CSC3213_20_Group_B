import { Suspense } from 'react';

import Home from '@/app/_components/home';
import { ProjectHomeLoading } from '@/components/projects/project-states';

export default function Page() {
  return (
    <Suspense fallback={<ProjectHomeLoading />}>
      <Home />
    </Suspense>
  );
}
