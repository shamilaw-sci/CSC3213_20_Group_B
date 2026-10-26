import { Skeleton } from '@scs/ui/components/skeleton';

export function DepartmentPageLoading() {
  return (
    <div
      role="status"
      aria-label="Loading department page"
      aria-live="polite"
      aria-busy="true"
      className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8"
    >
      <span className="sr-only">Loading department page</span>
      <div className="bg-muted/45 grid overflow-hidden border-y lg:grid-cols-2">
        <div className="px-5 py-12 sm:px-8 sm:py-16">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-6 h-12 w-full max-w-xl" />
          <Skeleton className="mt-3 h-12 w-4/5 max-w-lg" />
          <div className="mt-7 max-w-xl space-y-3">
            <Skeleton className="h-5" />
            <Skeleton className="h-5 w-5/6" />
          </div>
        </div>
        <Skeleton className="min-h-56 rounded-none lg:min-h-full" />
      </div>
      <div className="mt-10 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-9 w-full max-w-sm" />
          <Skeleton className="mt-3 h-9 w-4/5 max-w-xs" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-5" />
          <Skeleton className="h-5" />
          <Skeleton className="h-5 w-4/5" />
        </div>
      </div>
    </div>
  );
}
