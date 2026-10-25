import { Suspense } from 'react';

import FindByUsernamePage from '@/app/find-by/_components/find-by-username-page';
import { ProjectSearchLoading } from '@/components/projects/project-states';

export const metadata = {
  title: 'Find Projects by Username',
  description: 'Find SCS projects connected to a published username.',
};

export default function Page() {
  return (
    <Suspense
      fallback={<ProjectSearchLoading label="Loading username search" />}
    >
      <FindByUsernamePage />
    </Suspense>
  );
}
