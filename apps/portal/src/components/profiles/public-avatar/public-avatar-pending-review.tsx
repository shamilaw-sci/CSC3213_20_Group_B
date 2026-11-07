'use client';

import type {
  PublicAvatarCheck,
  PublicAvatarPendingReview,
} from '@scs/schemas';
import { Badge } from '@scs/ui/components/badge';
import { Button } from '@scs/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@scs/ui/components/dialog';
import { cn } from 'cn';
import {
  CheckCircle2,
  Circle,
  Clock3,
  LoaderCircle,
  Trash2,
  TriangleAlert,
  Upload,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';

import { moderationCheckLabel } from '@/lib/public-avatar';

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

function formatSubmittedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
}

interface PublicAvatarPendingReviewPanelProps {
  busy: boolean;
  onChange: () => void;
  onWithdraw: () => void;
  review: PublicAvatarPendingReview;
}

export function PublicAvatarPendingReviewPanel({
  busy,
  onChange,
  onWithdraw,
  review,
}: PublicAvatarPendingReviewPanelProps) {
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const checks = review.moderation?.checks ?? [];

  return (
    <section
      aria-labelledby="avatar-pending-heading"
      className="border-warning-border bg-warning-surface
        text-warning-surface-foreground space-y-4 rounded-xl border p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <Clock3 aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="avatar-pending-heading" className="text-base font-semibold">
              Picture awaiting review
            </h2>
            <Badge variant="outline" className="bg-background/70">
              Not published
            </Badge>
          </div>
          <p className="text-sm/6">
            An administrator will look at this picture before it is published.
            Your currently published picture, if any, stays visible in the
            People directory until a decision is made.
          </p>
          <p className="flex items-center gap-1 text-xs">
            <Clock3 className="size-3" aria-hidden="true" />
            Submitted {formatSubmittedAt(review.submittedAt)}
          </p>
        </div>
      </div>

      {checks.length ? (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide uppercase">
            Automatic checks
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2">
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
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={onChange}>
          <Upload />
          Change picture
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-destructive hover:text-destructive"
          disabled={busy}
          onClick={() => setConfirmWithdraw(true)}
        >
          {busy ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
          Withdraw review picture
        </Button>
      </div>
      <p className="text-xs">
        Choosing a different picture replaces this candidate. Withdrawing only
        removes the candidate and does not remove your published picture.
      </p>

      <Dialog open={confirmWithdraw} onOpenChange={setConfirmWithdraw}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw this review picture?</DialogTitle>
            <DialogDescription>
              The candidate will be removed and will not be published. Your
              currently published picture, if any, is not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmWithdraw(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => {
                setConfirmWithdraw(false);
                onWithdraw();
              }}
            >
              <Trash2 />
              Withdraw picture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
