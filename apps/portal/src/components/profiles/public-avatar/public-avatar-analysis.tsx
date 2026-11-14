'use client';

import type { PublicAvatarCheck, PublicAvatarModeration } from '@scs/schemas';
import { Badge } from '@scs/ui/components/badge';
import { Button } from '@scs/ui/components/button';
import { cn } from 'cn';
import {
  CheckCircle2,
  Circle,
  Clock3,
  CloudOff,
  LoaderCircle,
  TriangleAlert,
  XCircle,
} from 'lucide-react';

import type { PublicAvatarAnalysis } from '@/lib/public-avatar';
import {
  formatRetryAfter,
  moderationCheckLabel,
  moderationRecommendations,
} from '@/lib/public-avatar';

type Tone = 'destructive' | 'info' | 'success' | 'warning';

const toneClasses: Record<Tone, string> = {
  info: 'border-info-border bg-info-surface text-info-surface-foreground',
  success:
    'border-success-border bg-success-surface text-success-surface-foreground',
  destructive:
    'border-destructive-border bg-destructive-surface text-destructive-surface-foreground',
  warning:
    'border-warning-border bg-warning-surface text-warning-surface-foreground',
};

const checkStatusLabels: Record<
  PublicAvatarCheck['status'],
  { className: string; label: string }
> = {
  passed: {
    className: 'text-success-surface-foreground',
    label: 'Passed',
  },
  failed: {
    className: 'text-destructive-surface-foreground',
    label: 'Did not pass',
  },
  needs_review: {
    className: 'text-warning-surface-foreground',
    label: 'Needs review',
  },
  not_checked: {
    className: 'text-muted-foreground',
    label: 'Not completed',
  },
};

function CheckIcon({ status }: { status: PublicAvatarCheck['status'] }) {
  if (status === 'passed') return <CheckCircle2 aria-hidden="true" />;
  if (status === 'failed') return <XCircle aria-hidden="true" />;
  if (status === 'needs_review') return <TriangleAlert aria-hidden="true" />;
  return <Circle aria-hidden="true" />;
}

function Findings({ checks }: { checks: PublicAvatarCheck[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold tracking-wide uppercase">Checks</h3>
      <ul className="space-y-2">
        {checks.map((check) => {
          const status = checkStatusLabels[check.status];
          return (
            <li
              key={check.id}
              className="bg-background/70 flex flex-wrap items-center
                justify-between gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2 font-medium">
                <span className={status.className}>
                  <CheckIcon status={check.status} />
                </span>
                {moderationCheckLabel(check)}
              </span>
              <span className={cn('text-xs font-medium', status.className)}>
                {status.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Recommendations({
  moderation,
}: {
  moderation: PublicAvatarModeration;
}) {
  const recommendations = moderationRecommendations(moderation);
  if (!recommendations.length) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold tracking-wide uppercase">
        What to try next
      </h3>
      <ul className="list-disc space-y-1.5 pl-5 text-sm/6">
        {recommendations.map((recommendation) => (
          <li key={recommendation}>{recommendation}</li>
        ))}
      </ul>
    </div>
  );
}

interface AnalysisActionsProps {
  canRetry: boolean;
  onChooseAnother: () => void;
  onDismiss: () => void;
  onRetry: () => void;
  retryLabel?: string;
}

function AnalysisActions({
  canRetry,
  onChooseAnother,
  onDismiss,
  onRetry,
  retryLabel = 'Try again',
}: AnalysisActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" onClick={onChooseAnother}>
        Choose another picture
      </Button>
      {canRetry ? (
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
      <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  );
}

interface PublicAvatarAnalysisPanelProps {
  analysis: PublicAvatarAnalysis;
  canRetry: boolean;
  onChooseAnother: () => void;
  onDismiss: () => void;
  onRetry: () => void;
}

export function PublicAvatarAnalysisPanel({
  analysis,
  canRetry,
  onChooseAnother,
  onDismiss,
  onRetry,
}: PublicAvatarAnalysisPanelProps) {
  if (analysis.kind === 'idle') return null;

  if (analysis.kind === 'analyzing')
    return (
      <section
        aria-live="polite"
        aria-busy="true"
        className={cn(
          'space-y-4 rounded-xl border p-4 sm:p-5',
          toneClasses.info
        )}
      >
        <div className="flex items-start gap-3">
          <LoaderCircle
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 animate-spin"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">
                Uploading and checking your picture
              </h2>
              <Badge variant="outline" className="bg-background/70">
                In progress
              </Badge>
            </div>
            <p className="text-sm/6">
              <span className="font-medium">{analysis.fileName}</span> is being
              uploaded, validated, and checked automatically. Keep this page
              open.
            </p>
          </div>
        </div>
        <div
          className="bg-info-border/50 h-1.5 w-full animate-pulse rounded-full"
          aria-hidden="true"
        />
        <p className="text-sm/6">
          Your current published picture stays visible until the new one is
          accepted and stored.
        </p>
      </section>
    );

  if (analysis.kind === 'approved')
    return (
      <section
        aria-live="polite"
        className={cn(
          'space-y-4 rounded-xl border p-4 sm:p-5',
          toneClasses.success
        )}
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">Picture accepted</h2>
              <Badge variant="outline" className="bg-background/70">
                Published
              </Badge>
            </div>
            <p className="text-sm/6">
              <span className="font-medium">{analysis.fileName}</span> passed
              the automatic checks and is now your public picture in the People
              directory.
            </p>
          </div>
        </div>
        {analysis.moderation ? (
          <Findings checks={analysis.moderation.checks} />
        ) : null}
        <Button type="button" size="sm" variant="outline" onClick={onDismiss}>
          Dismiss
        </Button>
      </section>
    );

  if (analysis.kind === 'rejected')
    return (
      <section
        aria-live="assertive"
        className={cn(
          'space-y-4 rounded-xl border p-4 sm:p-5',
          toneClasses.destructive
        )}
      >
        <div className="flex items-start gap-3">
          <XCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">Picture not accepted</h2>
              <Badge variant="outline" className="bg-background/70">
                Not published
              </Badge>
            </div>
            <p className="text-sm/6">{analysis.message}</p>
            <p className="text-sm/6">
              Your previous public picture, if any, is unchanged.
            </p>
          </div>
        </div>
        {analysis.moderation ? (
          <Findings checks={analysis.moderation.checks} />
        ) : null}
        {analysis.moderation ? (
          <Recommendations moderation={analysis.moderation} />
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={onChooseAnother}>
            Choose another picture
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </section>
    );

  if (analysis.kind === 'review_required')
    return (
      <section
        aria-live="assertive"
        className={cn(
          'space-y-4 rounded-xl border p-4 sm:p-5',
          toneClasses.warning
        )}
      >
        <div className="flex items-start gap-3">
          <TriangleAlert
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">
                Picture is waiting for review
              </h2>
              <Badge variant="outline" className="bg-background/70">
                Pending review
              </Badge>
            </div>
            <p className="text-sm/6">
              The automatic check could not confidently approve this picture, so
              an administrator will review it. This is not a confirmed policy
              rejection. The candidate is shown beside your published picture
              until a decision is made.
            </p>
            <p className="text-sm/6">{analysis.message}</p>
          </div>
        </div>
        {analysis.moderation ? (
          <Findings checks={analysis.moderation.checks} />
        ) : null}
        {analysis.moderation ? (
          <Recommendations moderation={analysis.moderation} />
        ) : null}
        <AnalysisActions
          canRetry={canRetry}
          onChooseAnother={onChooseAnother}
          onDismiss={onDismiss}
          onRetry={onRetry}
          retryLabel="Check again"
        />
        {canRetry ? (
          <p className="text-xs">
            Checking again submits the picture again and uses another upload
            attempt.
          </p>
        ) : null}
      </section>
    );

  if (analysis.kind === 'unavailable')
    return (
      <section
        aria-live="assertive"
        className={cn(
          'space-y-4 rounded-xl border p-4 sm:p-5',
          toneClasses.warning
        )}
      >
        <div className="flex items-start gap-3">
          <CloudOff aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">
                Image check unavailable
              </h2>
              <Badge variant="outline" className="bg-background/70">
                Not published
              </Badge>
            </div>
            <p className="text-sm/6">
              The automatic image check could not be completed, so the picture
              was not published. Please try again later; your picture was not
              rejected.
            </p>
            <p className="text-sm/6">{analysis.message}</p>
          </div>
        </div>
        {analysis.moderation ? (
          <Findings checks={analysis.moderation.checks} />
        ) : null}
        <AnalysisActions
          canRetry={canRetry}
          onChooseAnother={onChooseAnother}
          onDismiss={onDismiss}
          onRetry={onRetry}
        />
        {canRetry ? (
          <p className="text-xs">
            Retrying submits the picture again and uses another upload attempt.
          </p>
        ) : null}
      </section>
    );

  if (analysis.kind === 'rate_limited') {
    const retry = formatRetryAfter(analysis.retryAfterSeconds);
    return (
      <section
        aria-live="assertive"
        className={cn(
          'space-y-4 rounded-xl border p-4 sm:p-5',
          toneClasses.warning
        )}
      >
        <div className="flex items-start gap-3">
          <Clock3 aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-base font-semibold">Upload limit reached</h2>
            <p className="text-sm/6">{analysis.message}</p>
            <p className="text-sm/6">
              {retry
                ? `The server asked you to wait ${retry} before trying again.`
                : 'Wait for the hourly limit to reset before trying again.'}
            </p>
          </div>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </section>
    );
  }

  return (
    <section
      aria-live="assertive"
      className={cn(
        'space-y-4 rounded-xl border p-4 sm:p-5',
        toneClasses.destructive
      )}
    >
      <div className="flex items-start gap-3">
        <XCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-base font-semibold">
            {analysis.retryable
              ? 'Upload did not finish'
              : 'Picture not uploaded'}
          </h2>
          <p className="text-sm/6">{analysis.message}</p>
          {!analysis.retryable ? (
            <p className="text-sm/6">
              Choose a different image that meets the requirements below.
            </p>
          ) : null}
        </div>
      </div>
      <AnalysisActions
        canRetry={analysis.retryable && canRetry}
        onChooseAnother={onChooseAnother}
        onDismiss={onDismiss}
        onRetry={onRetry}
      />
      {analysis.code ? (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium">
            Technical details
          </summary>
          <p className="text-muted-foreground mt-2 font-mono">
            {analysis.code}
          </p>
        </details>
      ) : null}
    </section>
  );
}
