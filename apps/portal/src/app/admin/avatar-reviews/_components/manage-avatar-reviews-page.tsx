'use client';

import type { PublicAvatarCheck, PublicAvatarReview } from '@scs/schemas';
import { Badge } from '@scs/ui/components/badge';
import { Button } from '@scs/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@scs/ui/components/card';
import { Check, Clock3, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { BackButton } from '@/components/navigation/back-button';
import { Pagination } from '@/components/navigation/pagination';
import { AdminAvatarReviewPreview } from '@/components/profiles/admin-avatar-review-preview';
import {
  decideAdminAvatarReview,
  resetAdminAvatarRate,
} from '@/lib/admin-avatar';

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
}

function statusClass(status: PublicAvatarCheck['status']): string {
  if (status === 'passed')
    return 'border-success-border bg-success-surface text-success-surface-foreground';
  if (status === 'failed')
    return 'border-destructive-border bg-destructive-surface text-destructive-surface-foreground';
  return 'border-warning-border bg-warning-surface text-warning-surface-foreground';
}

interface ManageAvatarReviewsPageProps {
  items: PublicAvatarReview[];
  previousHref?: string;
  nextHref?: string;
}

export default function ManageAvatarReviewsPage({
  items,
  previousHref,
  nextHref,
}: ManageAvatarReviewsPageProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);

  async function resetUploadCount(username: string) {
    if (busyId || resetting) return;
    setResetting(username);
    try {
      const { quota } = await resetAdminAvatarRate(username);
      toast.success(
        `Upload count reset for @${username}. ${quota.remaining} of ${quota.limit} attempts remain.`
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not reset the upload count.'
      );
    } finally {
      setResetting(null);
    }
  }

  async function decide(
    review: PublicAvatarReview,
    action: 'approve' | 'reject'
  ) {
    if (busyId) return;
    setBusyId(review.id);
    try {
      await decideAdminAvatarReview(review.id, action);
      toast.success(
        action === 'approve'
          ? 'The picture is now published.'
          : 'The review was rejected.'
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not update the review.'
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <PageShell width="wide">
      <BackButton fallbackHref="/admin" label="Back to Admin" preferFallback />
      <PageHeader
        title="Avatar Reviews"
        description="Pictures that the automatic check could not decide. Approving publishes the picture and records the administrator who allowed it."
      />

      {items.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-12 text-center">
            <ShieldCheck
              className="text-muted-foreground mx-auto size-8"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <h2 className="font-semibold">No pictures need review</h2>
              <p className="text-muted-foreground text-sm">
                New review requests appear here after a member uploads a picture
                that the automatic check cannot approve.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {items.map((review) => (
            <li key={review.id}>
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>@{review.username}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <Clock3 className="size-3" aria-hidden="true" />
                        Submitted {formatTime(review.submittedAt)}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">Pending</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AdminAvatarReviewPreview
                    reviewId={review.id}
                    username={review.username}
                    alt={`Picture submitted by ${review.username}`}
                    className="mx-auto aspect-square w-full max-w-48"
                  />
                  <ul className="flex flex-wrap gap-2 text-xs">
                    {(review.moderation?.checks ?? []).map((check) => (
                      <li key={check.id}>
                        <Badge
                          variant="outline"
                          className={statusClass(check.status)}
                        >
                          {check.id === 'safety' ? 'Safety' : 'Portrait'}:{' '}
                          {check.status.replaceAll('_', ' ')}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => void decide(review, 'approve')}
                    >
                      <Check />
                      Allow and publish
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      disabled={busyId !== null}
                      onClick={() => void decide(review, 'reject')}
                    >
                      <X />
                      Reject
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busyId !== null || resetting !== null}
                      title={`Reset @${review.username}'s hourly upload count`}
                      onClick={() => void resetUploadCount(review.username)}
                    >
                      <RotateCcw />
                      {resetting === review.username
                        ? 'Resetting…'
                        : 'Reset upload count'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Pagination previousHref={previousHref} nextHref={nextHref} />
    </PageShell>
  );
}
