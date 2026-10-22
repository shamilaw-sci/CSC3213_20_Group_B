import type { ReactNode } from 'react';

import { cn } from '#lib/utils';

export interface FeedbackStateProps {
  actions?: ReactNode;
  className?: string;
  code?: string;
  description: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
}

export function FeedbackState({
  actions,
  className,
  code,
  description,
  icon,
  title,
}: FeedbackStateProps) {
  return (
    <section
      data-slot="feedback-state"
      className={cn(
        'mx-auto flex w-full max-w-xl flex-col items-center px-6 py-16 text-center',
        className
      )}
    >
      {icon ? (
        <div className="mb-6 text-primary" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      {code ? (
        <p className="mb-3 text-sm font-semibold tracking-[0.16em] text-primary uppercase">
          {code}
        </p>
      ) : null}
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {title}
      </h1>
      <div className="mt-4 max-w-prose text-base leading-7 text-muted-foreground">
        {description}
      </div>
      {actions ? (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {actions}
        </div>
      ) : null}
    </section>
  );
}
