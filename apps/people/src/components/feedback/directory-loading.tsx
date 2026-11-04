import type { ReactNode } from 'react';

function HeaderSkeleton({
  breadcrumbItems = 2,
  titleWidth = 'w-80',
  descriptionWidth = 'w-96',
}: {
  breadcrumbItems?: number;
  titleWidth?: string;
  descriptionWidth?: string | null;
}) {
  return (
    <header className="mb-6 border-b pb-5">
      <div className="mb-4 flex items-center gap-2">
        {Array.from({ length: breadcrumbItems }, (_, index) => (
          <div key={index} className="flex items-center gap-2">
            {index > 0 && <div className="bg-muted h-4 w-2 rounded" />}
            <div
              className={`bg-muted h-4 rounded ${
                index === 0 ? 'w-12' : 'w-24'
              }`}
            />
          </div>
        ))}
      </div>
      <div className={`bg-muted h-9 max-w-full rounded ${titleWidth}`} />
      {descriptionWidth && (
        <div
          className={`bg-muted mt-3 h-4 max-w-full rounded ${descriptionWidth}`}
        />
      )}
    </header>
  );
}

function PageLoadingShell({
  children,
  breadcrumbItems,
  titleWidth,
  descriptionWidth,
}: {
  children: ReactNode;
  breadcrumbItems?: number;
  titleWidth?: string;
  descriptionWidth?: string | null;
}) {
  return (
    <main
      role="status"
      aria-label="Loading directory"
      aria-live="polite"
      aria-busy="true"
      className="mx-auto w-full max-w-6xl animate-pulse px-4 py-6"
    >
      <span className="sr-only">Loading directory</span>
      <HeaderSkeleton
        breadcrumbItems={breadcrumbItems}
        titleWidth={titleWidth}
        descriptionWidth={descriptionWidth}
      />
      {children}
    </main>
  );
}

export function IndexCardsLoading({
  breadcrumbItems = 2,
  sections = 1,
  cards = 3,
  titleWidth = 'w-72',
}: {
  breadcrumbItems?: number;
  sections?: number;
  cards?: number;
  titleWidth?: string;
}) {
  return (
    <PageLoadingShell breadcrumbItems={breadcrumbItems} titleWidth={titleWidth}>
      {Array.from({ length: sections }, (_, sectionIndex) => (
        <section key={sectionIndex} className="mb-8 last:mb-0">
          {sections > 1 && <div className="bg-muted mb-6 h-7 w-24 rounded" />}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: cards }, (_, cardIndex) => (
              <div
                key={cardIndex}
                className="bg-card flex min-h-36 flex-col items-start
                  justify-between rounded-md border p-4"
              >
                <div className="bg-muted size-8 rounded-md" />
                <div className="bg-muted h-5 w-32 max-w-full rounded" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </PageLoadingShell>
  );
}

export function PeopleGridLoading({
  breadcrumbItems = 3,
  withTabs = false,
  count = 10,
  titleWidth = 'w-72',
}: {
  breadcrumbItems?: number;
  withTabs?: boolean;
  count?: number;
  titleWidth?: string;
}) {
  return (
    <PageLoadingShell breadcrumbItems={breadcrumbItems} titleWidth={titleWidth}>
      {withTabs && (
        <div className="mb-8 grid gap-2 sm:grid-cols-3">
          <div className="bg-muted h-10 rounded-md" />
          <div className="bg-muted h-10 rounded-md" />
          <div className="bg-muted h-10 rounded-md" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }, (_, index) => (
          <div
            key={index}
            className="bg-card flex min-h-88 flex-col gap-4 rounded-md border
              p-4"
          >
            <div className="bg-muted h-52 w-full rounded-md sm:h-48" />
            <div
              className="flex min-h-28 w-full flex-1 flex-col items-center
                space-y-3"
            >
              <div className="bg-muted h-4 w-3/4 rounded" />
              <div className="bg-muted h-3 w-1/2 rounded" />
              <div className="bg-muted h-3 w-2/3 rounded" />
              <div className="bg-muted mt-auto h-9 w-full rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </PageLoadingShell>
  );
}

export function BatchDirectoryLoading() {
  return (
    <PageLoadingShell
      breadcrumbItems={3}
      titleWidth="w-64"
      descriptionWidth="w-56"
    >
      <div className="mb-5 flex items-center gap-2">
        <div className="bg-muted size-5 rounded" />
        <div className="bg-muted h-4 w-28 rounded" />
      </div>
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4
          xl:grid-cols-5"
      >
        {Array.from({ length: 10 }, (_, index) => (
          <div
            key={index}
            className="bg-card flex min-h-36 flex-col items-start
              justify-between rounded-md border p-4"
          >
            <div className="w-full space-y-2">
              <div className="bg-muted h-4 w-3/4 rounded" />
              <div className="bg-muted h-3 w-1/2 rounded" />
            </div>
            <div className="bg-muted h-6 w-16 rounded-md" />
          </div>
        ))}
      </div>
    </PageLoadingShell>
  );
}

export function ProfileLoading() {
  return (
    <PageLoadingShell titleWidth="w-72" descriptionWidth={null}>
      <article className="grid gap-6 lg:grid-cols-[22rem_1fr] lg:items-start">
        <aside className="bg-card rounded-md border p-5">
          <div className="bg-muted h-80 w-full rounded-md" />
          <div className="mt-5 space-y-3">
            <div className="bg-muted h-7 w-3/4 rounded" />
            <div className="bg-muted h-4 w-1/2 rounded" />
            <div className="bg-muted h-4 w-1/3 rounded" />
          </div>
          <div className="mt-6">
            <div className="bg-muted mb-3 h-3 w-12 rounded" />
            <div className="flex flex-wrap gap-2">
              <div className="bg-muted size-10 rounded-md" />
              <div className="bg-muted size-10 rounded-md" />
              <div className="bg-muted size-10 rounded-md" />
              <div className="bg-muted size-10 rounded-md" />
            </div>
          </div>
        </aside>

        <section>
          <div className="mb-5 flex flex-wrap gap-2 border-b pb-3">
            <div className="bg-muted h-8 w-20 rounded-md" />
            <div className="bg-muted h-8 w-20 rounded-md" />
            <div className="bg-muted h-8 w-20 rounded-md" />
          </div>
          <div className="bg-card rounded-md border p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="bg-muted h-20 rounded-md" />
              ))}
            </div>
          </div>
        </section>
      </article>
    </PageLoadingShell>
  );
}
