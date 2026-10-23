import { Suspense } from 'react';

import FindByUsernamePage from '@/app/find-by/_components/find-by-username-page';
import { ProjectListLoading } from '@/components/custom/StatePanel';

export const metadata = {
  title: 'Find Projects by Username',
  description: 'Find SCS projects connected to a published username.',
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
      <FindByUsernamePage />
    </Suspense>
  );
}
