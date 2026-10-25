'use client';

import { Button } from '@scs/ui/components/button';
import { Skeleton } from '@scs/ui/components/skeleton';
import { cn } from 'cn';
import { AlertTriangle, ArrowRight, FolderSearch, Search } from 'lucide-react';
import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';

type StatePanelAction = {
  href: string;
  label: string;
};

const toneClasses = {
  neutral: 'bg-card',
  warning: 'bg-warning-surface',
  danger: 'bg-destructive-surface',
};

export function StatePanel({
  title,
  description,
  icon: Icon = FolderSearch,
  action,
  secondaryAction,
  onRetry,
  retryLabel = 'Try again',
  tone = 'neutral',
  iconClassName,
  className,
}: Readonly<{
  title: string;
  description: string;
  icon?: ComponentType<{ className?: string }>;
  action?: StatePanelAction;
  secondaryAction?: StatePanelAction;
  onRetry?: () => void;
  retryLabel?: string;
  tone?: keyof typeof toneClasses;
  iconClassName?: string;
  className?: string;
}>) {
  return (
    <div
      className={cn(
        'rounded-md border p-6 shadow-sm sm:p-8',
        toneClasses[tone],
        className
      )}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <span
          className="bg-primary/10 text-primary flex size-12 shrink-0
            items-center justify-center rounded-md"
        >
          <Icon className={cn('size-6', iconClassName)} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-card-foreground text-lg font-semibold">
            {title}
          </h2>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm/6">
            {description}
          </p>
          {action || secondaryAction || onRetry ? (
            <div className="mt-5 flex flex-wrap gap-3">
              {onRetry ? (
                <Button type="button" onClick={onRetry}>
                  {retryLabel}
                </Button>
              ) : null}
              {action ? (
                <Button asChild>
                  <Link href={action.href}>
                    {action.label}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : null}
              {secondaryAction ? (
                <Button asChild variant="outline">
                  <Link href={secondaryAction.href}>
                    {secondaryAction.label}
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ProjectListLoading({
  count = 3,
  className,
  label = 'Loading projects',
}: Readonly<{ count?: number; className?: string; label?: string }>) {
  return (
    <LoadingRegion className={className} label={label}>
      <ProjectListSkeleton count={count} />
    </LoadingRegion>
  );
}

export function TileGridLoading({
  count = 6,
  className,
  label = 'Loading items',
}: Readonly<{ count?: number; className?: string; label?: string }>) {
  return (
    <LoadingRegion className={className} label={label}>
      <TileGridSkeleton count={count} />
    </LoadingRegion>
  );
}

export function ProjectDetailLoading({
  className,
  label = 'Loading project',
}: Readonly<{ className?: string; label?: string }>) {
  return (
    <LoadingRegion className={className} label={label}>
      <section className="bg-card border-b">
        <div className="mx-auto max-w-6xl space-y-5 px-4 py-14">
          <Skeleton className="size-14" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-28" />
          </div>
          <Skeleton className="h-10 w-3/4 max-w-3xl" />
          <Skeleton className="h-5 w-full max-w-2xl" />
        </div>
      </section>
      <section
        className="mx-auto grid max-w-6xl gap-8 px-4 py-10
          lg:grid-cols-[1fr_20rem]"
      >
        <div className="space-y-6">
          <ContentPanelLoading lines={5} />
          <ContentPanelLoading lines={3} />
        </div>
        <div className="space-y-5">
          <ContentPanelLoading lines={5} />
          <ContentPanelLoading lines={3} />
        </div>
      </section>
    </LoadingRegion>
  );
}

export function ProjectCollectionLoading({
  label = 'Loading project collection',
}: Readonly<{ label?: string }>) {
  return (
    <LoadingRegion label={label}>
      <PageIntroLoading />
      <section
        className="mx-auto grid max-w-6xl gap-8 px-4 py-10
          lg:grid-cols-[1fr_18rem]"
      >
        <div className="space-y-5">
          <Skeleton className="h-14 w-full" />
          <ProjectListSkeleton count={3} />
        </div>
        <div className="space-y-5">
          <ContentPanelLoading lines={5} />
          <ContentPanelLoading lines={4} />
        </div>
      </section>
    </LoadingRegion>
  );
}

export function ProjectIndexLoading({
  label = 'Loading project index',
}: Readonly<{ label?: string }>) {
  return (
    <LoadingRegion label={label}>
      <PageIntroLoading />
      <section className="mx-auto max-w-6xl px-4 py-10">
        <TileGridSkeleton count={6} />
      </section>
    </LoadingRegion>
  );
}

export function ProjectSearchLoading({
  label = 'Loading project search',
}: Readonly<{ label?: string }>) {
  return (
    <LoadingRegion label={label}>
      <section className="bg-card border-b">
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-10">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-72 max-w-full" />
          <Skeleton className="h-11 w-full max-w-2xl" />
        </div>
      </section>
      <section className="mx-auto max-w-6xl space-y-5 px-4 py-10">
        <Skeleton className="h-20 w-full" />
        <ProjectListSkeleton count={3} />
      </section>
    </LoadingRegion>
  );
}

export function ProjectHomeLoading() {
  return (
    <LoadingRegion label="Loading projects home">
      <section className="bg-card border-b">
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-12">
          <Skeleton className="h-4 w-64 max-w-full" />
          <Skeleton className="h-12 w-80 max-w-full" />
          <Skeleton className="h-5 w-full max-w-2xl" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-36" />
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl space-y-6 px-4 py-10">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-14" />
          ))}
        </div>
      </section>
      <section className="bg-card border-y">
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-12">
          <Skeleton className="h-8 w-48" />
          <ProjectListSkeleton count={4} />
        </div>
      </section>
    </LoadingRegion>
  );
}

function LoadingRegion({
  children,
  className,
  label,
}: Readonly<{
  children: ReactNode;
  className?: string;
  label: string;
}>) {
  return (
    <div
      className={className}
      role="status"
      aria-label={label}
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

function PageIntroLoading() {
  return (
    <section className="bg-card border-b">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-12">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-11 w-2/3 max-w-2xl" />
        <Skeleton className="h-5 w-full max-w-3xl" />
      </div>
    </section>
  );
}

function ProjectListSkeleton({ count }: Readonly<{ count: number }>) {
  return (
    <div className="grid gap-5">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="bg-card grid gap-4 rounded-md border p-4 shadow-sm
            md:grid-cols-[2.5rem_minmax(0,1fr)_auto] md:items-start"
        >
          <Skeleton className="size-10" />
          <div className="min-w-0 space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-4 w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-16" />
            </div>
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
      ))}
    </div>
  );
}

function TileGridSkeleton({ count }: Readonly<{ count: number }>) {
  return (
    <div
      className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]
        gap-4"
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="bg-card space-y-4 rounded-md border p-5">
          <div className="flex items-start justify-between gap-4">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-5 w-10" />
          </div>
          <Skeleton className="h-4 w-4/5" />
        </div>
      ))}
    </div>
  );
}

function ContentPanelLoading({ lines }: Readonly<{ lines: number }>) {
  return (
    <div className="bg-card space-y-4 rounded-md border p-5">
      <Skeleton className="h-5 w-32" />
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={cn('h-4', index === lines - 1 && 'w-2/3')}
        />
      ))}
    </div>
  );
}

export function EmptyProjectsPanel({
  title = 'No projects to show',
  description = 'Try a broader search or browse the project collections.',
  className,
}: Readonly<{
  title?: string;
  description?: string;
  className?: string;
}>) {
  return (
    <StatePanel
      title={title}
      description={description}
      icon={Search}
      action={{ href: '/search', label: 'Search projects' }}
      secondaryAction={{ href: '/categories', label: 'Browse collections' }}
      className={className}
    />
  );
}

export function ProjectErrorPanel({
  title = 'Projects are unavailable',
  description = 'The published project data could not be loaded right now.',
  onRetry,
  className,
}: Readonly<{
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}>) {
  return (
    <StatePanel
      title={title}
      description={description}
      icon={AlertTriangle}
      tone="warning"
      onRetry={onRetry}
      action={onRetry ? undefined : { href: '/', label: 'Go home' }}
      secondaryAction={{ href: '/search', label: 'Open search' }}
      className={className}
    />
  );
}
