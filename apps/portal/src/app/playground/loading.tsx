import { Skeleton } from '@scs/ui/components/skeleton';

import { PageShell } from '@/components/layout/page-shell';

export default function Loading() {
  return (
    <PageShell width="wide">
      <div
        role="status"
        aria-label="Loading public data playground"
        className="flex flex-col gap-6"
      >
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </PageShell>
  );
}
