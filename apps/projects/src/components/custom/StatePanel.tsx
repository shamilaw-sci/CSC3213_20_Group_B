'use client';

import { Button } from '@scs/ui/components/button';
import { cn } from 'cn';
import { AlertTriangle, ArrowRight, FolderSearch, Search } from 'lucide-react';
import Link from 'next/link';
import type { ComponentType } from 'react';

type StatePanelAction = {
  href: string;
  label: string;
};

const toneClasses = {
  neutral: 'bg-card',
  warning: 'bg-amber-50/80 dark:bg-amber-400/10',
  danger: 'bg-red-50/80 dark:bg-red-400/10',
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
        <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className={cn('size-6', iconClassName)} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-card-foreground">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
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
  className,
  label = 'Loading projects',
}: Readonly<{ count?: number; className?: string; label?: string }>) {
  return <BlankShimmerLoading className={className} label={label} />;
}

export function TileGridLoading({
  className,
  label = 'Loading items',
}: Readonly<{ count?: number; className?: string; label?: string }>) {
  return <BlankShimmerLoading className={className} label={label} />;
}

export function ProjectDetailLoading({
  className,
  label = 'Loading project',
}: Readonly<{ className?: string; label?: string }>) {
  return <BlankShimmerLoading className={className} label={label} />;
}

function BlankShimmerLoading({
  className,
  label,
}: Readonly<{ className?: string; label: string }>) {
  return (
    <div
      className={cn('loading-shimmer-page', className)}
      role="status"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
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
