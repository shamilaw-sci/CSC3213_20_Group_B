import { Skeleton } from '@scs/ui/components/skeleton';
import { cn } from 'cn';
import type { ReactNode } from 'react';

type PageLoadingVariant = 'cards' | 'detail' | 'table';

interface PageLoadingPanelProps {
  className?: string;
  variant?: PageLoadingVariant;
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

export function PortalHomeLoading() {
  return (
    <LoadingRegion
      label="Loading portal home"
      className="bg-muted/45 flex min-h-[calc(100svh-7rem)] items-center
        justify-center px-6 py-12"
    >
      <div className="flex w-full max-w-xl flex-col items-center text-center">
        <Skeleton className="size-24 rounded-full" />
        <Skeleton className="mt-4 h-10 w-72 max-w-full" />
        <Skeleton className="mt-8 h-7 w-96 max-w-full" />
        <Skeleton className="mt-3 h-5 w-80 max-w-full" />
        <div className="mt-6 w-full max-w-lg space-y-2">
          <Skeleton className="h-4" />
          <Skeleton className="mx-auto h-4 w-4/5" />
        </div>
        <div className="mt-8 flex gap-3">
          <Skeleton className="h-11 w-32" />
          <Skeleton className="h-11 w-36" />
        </div>
        <Skeleton className="mt-8 h-5 w-48" />
      </div>
    </LoadingRegion>
  );
}

export function AuthPageLoading() {
  return (
    <LoadingRegion
      label="Loading authentication page"
      className="bg-muted flex min-h-screen items-center justify-center p-6
        md:p-10"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <Skeleton className="size-24 rounded-full" />
        <Skeleton className="h-8 w-48" />
        <div className="bg-card w-full space-y-6 rounded-xl border p-6">
          <div className="space-y-3 text-center">
            <Skeleton className="mx-auto h-6 w-36" />
            <Skeleton className="mx-auto h-4 w-64 max-w-full" />
          </div>
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
          <Skeleton className="mx-auto h-4 w-48" />
        </div>
      </div>
    </LoadingRegion>
  );
}

export function DashboardLoading() {
  return (
    <LoadingRegion className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <HeaderLoading />
      <CardGridLoading />
    </LoadingRegion>
  );
}

export function AdminOverviewLoading() {
  return (
    <LoadingRegion className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
      <BackLoading />
      <HeaderLoading />
      <CardGridLoading count={4} columns="two" />
    </LoadingRegion>
  );
}

export function EditorPageLoading() {
  return (
    <LoadingRegion className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <BackLoading />
      <HeaderLoading action />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <div className="bg-card space-y-3 rounded-md border p-4">
          <Skeleton className="h-9" />
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-11" />
          ))}
        </div>
        <FormCardLoading fields={6} />
      </div>
    </LoadingRegion>
  );
}

export function TablePageLoading() {
  return (
    <LoadingRegion className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <BackLoading />
      <HeaderLoading action />
      <TableLoading />
    </LoadingRegion>
  );
}

export function ProfilePageLoading() {
  return (
    <LoadingRegion className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
      <BackLoading />
      <HeaderLoading action />
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <div className="bg-card space-y-4 rounded-md border p-5">
          <Skeleton className="mx-auto size-32 rounded-full" />
          <Skeleton className="mx-auto h-7 w-40" />
          <Skeleton className="mx-auto h-4 w-52" />
          <Skeleton className="mx-auto h-9 w-full" />
        </div>
        <div className="space-y-5">
          <DetailLoading />
          <FormCardLoading fields={3} />
        </div>
      </div>
    </LoadingRegion>
  );
}

export function FormPageLoading() {
  return (
    <LoadingRegion className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
      <BackLoading />
      <HeaderLoading />
      <FormCardLoading fields={4} />
      <FormCardLoading fields={3} />
      <div className="flex justify-end gap-3">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
    </LoadingRegion>
  );
}

export function SettingsPageLoading() {
  return (
    <LoadingRegion className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
      <BackLoading />
      <HeaderLoading />
      <FormCardLoading fields={3} />
      <FormCardLoading fields={4} />
    </LoadingRegion>
  );
}

export function AcademicRulesLoading() {
  return (
    <LoadingRegion className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <BackLoading />
      <HeaderLoading action />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <FormCardLoading fields={6} />
      <FormCardLoading fields={4} />
    </LoadingRegion>
  );
}

export function LegalPageLoading() {
  return (
    <LoadingRegion className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <BackLoading />
      <Skeleton className="h-9 w-64 max-w-full" />
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="bg-card space-y-4 rounded-xl border p-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4" />
          <Skeleton className="h-4" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </LoadingRegion>
  );
}

export function IntegrationPageLoading() {
  return (
    <LoadingRegion className="container mx-auto max-w-3xl space-y-6 px-4 py-8">
      <HeaderLoading />
      <Skeleton className="h-32" />
      <FormCardLoading fields={5} />
      <Skeleton className="h-24" />
    </LoadingRegion>
  );
}

export function DevelopmentPageLoading() {
  return (
    <LoadingRegion
      className="container mx-auto flex min-h-[60vh] max-w-5xl flex-col
        items-center justify-center px-4 py-8"
    >
      <Skeleton className="size-10" />
      <Skeleton className="mt-4 h-8 w-72 max-w-full" />
      <Skeleton className="mt-3 h-4 w-full max-w-md" />
      <Skeleton className="mt-2 h-4 w-3/4 max-w-sm" />
    </LoadingRegion>
  );
}

function LoadingRegion({
  children,
  className,
  label = 'Loading page',
}: Readonly<{ children: ReactNode; className?: string; label?: string }>) {
  return (
    <main
      role="status"
      aria-label={label}
      aria-live="polite"
      aria-busy="true"
      className={className}
    >
      <span className="sr-only">{label}</span>
      {children}
    </main>
  );
}

function HeaderLoading({ action = false }: Readonly<{ action?: boolean }>) {
  return (
    <header
      className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-end
        sm:justify-between"
    >
      <div className="space-y-3">
        <Skeleton className="h-8 w-48 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {action ? <Skeleton className="h-9 w-28" /> : null}
    </header>
  );
}

function BackLoading() {
  return <Skeleton className="h-9 w-36" />;
}

function CardGridLoading({
  count = 6,
  columns = 'three',
}: Readonly<{ count?: number; columns?: 'two' | 'three' }>) {
  return (
    <div
      className={cn(
        'grid gap-4 sm:grid-cols-2',
        columns === 'three' && 'lg:grid-cols-3'
      )}
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="bg-card flex min-h-32 items-start gap-4 rounded-md border
            p-5 shadow-sm"
        >
          <Skeleton className="size-10 shrink-0" />
          <div className="w-full space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailLoading() {
  return (
    <div className="bg-card space-y-5 rounded-md border p-6 shadow-sm">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-72 max-w-full" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <Skeleton className="h-24" />
    </div>
  );
}

function FormCardLoading({ fields }: Readonly<{ fields: number }>) {
  return (
    <div className="bg-card space-y-6 rounded-xl border p-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {Array.from({ length: fields }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TableLoading() {
  return (
    <div className="bg-card overflow-hidden rounded-md border shadow-sm">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
        <Skeleton className="h-9 w-full max-w-sm" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="divide-y">
        {Array.from({ length: 7 }, (_, index) => (
          <div key={index} className="grid gap-4 p-4 sm:grid-cols-4">
            <Skeleton className="h-4" />
            <Skeleton className="h-4" />
            <Skeleton className="h-4" />
            <Skeleton className="h-4" />
          </div>
        ))}
      </div>
    </div>
  );
}
