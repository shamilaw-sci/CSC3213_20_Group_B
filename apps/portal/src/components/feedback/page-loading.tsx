import { cn } from 'cn';

type PageLoadingVariant = 'cards' | 'detail' | 'table';

interface PageLoadingProps {
  className?: string;
  variant?: PageLoadingVariant;
}

interface PageLoadingPanelProps {
  className?: string;
  variant?: PageLoadingVariant;
}

function LoadingBlock({ className }: { className?: string }) {
  return <div className={cn('bg-muted rounded-md', className)} />;
}

export function PageLoading({
  className,
  variant = 'cards',
}: PageLoadingProps) {
  return (
    <main
      aria-busy="true"
      aria-label="Loading page"
      className={cn(
        'mx-auto w-full max-w-6xl animate-pulse space-y-6 px-4 py-8',
        className
      )}
    >
      <header
        className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-end
          sm:justify-between"
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <LoadingBlock className="size-6" />
            <LoadingBlock className="h-8 w-48 max-w-full" />
          </div>
          <LoadingBlock className="h-4 w-80 max-w-full" />
        </div>
        <LoadingBlock className="h-9 w-28" />
      </header>

      <PageLoadingPanel variant={variant} />
    </main>
  );
}

export function PageLoadingPanel({
  className,
  variant = 'cards',
}: PageLoadingPanelProps) {
  return (
    <div className={className}>
      {variant === 'cards' ? <CardGridLoading /> : null}
      {variant === 'detail' ? <DetailLoading /> : null}
      {variant === 'table' ? <TableLoading /> : null}
    </div>
  );
}

function CardGridLoading() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="bg-card flex min-h-32 items-start gap-4 rounded-md border
            p-5 shadow-sm"
        >
          <LoadingBlock className="size-10 shrink-0" />
          <div className="w-full space-y-3">
            <LoadingBlock className="h-5 w-32" />
            <div className="space-y-2">
              <LoadingBlock className="h-3 w-full" />
              <LoadingBlock className="h-3 w-4/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailLoading() {
  return (
    <div className="bg-card space-y-4 rounded-md border p-6 shadow-sm">
      <div
        className="flex flex-col gap-3 sm:flex-row sm:items-center
          sm:justify-between"
      >
        <div className="space-y-2">
          <LoadingBlock className="h-5 w-32" />
          <LoadingBlock className="h-4 w-64 max-w-full" />
        </div>
        <LoadingBlock className="h-9 w-28" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <LoadingBlock className="h-10" />
        <LoadingBlock className="h-10" />
        <LoadingBlock className="h-10" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <LoadingBlock className="h-72" />
        <div className="space-y-3">
          <LoadingBlock className="h-12" />
          <LoadingBlock className="h-12" />
          <LoadingBlock className="h-12" />
          <LoadingBlock className="h-28" />
        </div>
      </div>
    </div>
  );
}

function TableLoading() {
  return (
    <div className="bg-card rounded-md border shadow-sm">
      <div className="border-b p-4">
        <LoadingBlock className="h-9 w-full max-w-sm" />
      </div>
      <div className="divide-y">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="grid gap-4 p-4 sm:grid-cols-4">
            <LoadingBlock className="h-4" />
            <LoadingBlock className="h-4" />
            <LoadingBlock className="h-4" />
            <LoadingBlock className="h-4" />
          </div>
        ))}
      </div>
    </div>
  );
}
