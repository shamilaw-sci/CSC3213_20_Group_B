import { Skeleton } from '@scs/ui/components/skeleton';

export function DevelopmentPageLoading() {
  return (
    <main
      role="status"
      aria-label="Loading page"
      aria-live="polite"
      aria-busy="true"
      className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center
        justify-center px-6 py-16 text-center"
    >
      <span className="sr-only">Loading page</span>
      <Skeleton className="size-10" />
      <Skeleton className="mt-6 h-10 w-80 max-w-full" />
      <div className="mt-4 w-full max-w-md space-y-2">
        <Skeleton className="h-5" />
        <Skeleton className="mx-auto h-5 w-4/5" />
      </div>
    </main>
  );
}
