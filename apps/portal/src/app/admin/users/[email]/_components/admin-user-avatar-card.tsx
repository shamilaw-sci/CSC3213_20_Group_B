'use client';

import type {
  AdminUserAvatar,
  PublicAvatarAuditAction,
  PublicAvatarReview,
} from '@scs/schemas';
import { Badge } from '@scs/ui/components/badge';
import { Button } from '@scs/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@scs/ui/components/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@scs/ui/components/dialog';
import { Input } from '@scs/ui/components/input';
import { Label } from '@scs/ui/components/label';
import { Separator } from '@scs/ui/components/separator';
import {
  Check,
  Clock3,
  Image as ImageIcon,
  LoaderCircle,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { AdminAvatarReviewImage } from '@/components/profiles/admin-avatar-review-image';
import {
  decideAdminAvatarReview,
  deleteAdminUserAvatar,
  getAdminUserAvatar,
} from '@/lib/admin-avatar';

const ACTION_LABEL: Record<PublicAvatarAuditAction, string> = {
  upload: 'Uploaded',
  delete: 'Removed by owner',
  admin_delete: 'Removed by admin',
  review_submitted: 'Sent for review',
  review_approved: 'Review approved',
  review_rejected: 'Review rejected',
};

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
}

function reviewChecks(review: PublicAvatarReview) {
  return review.moderation?.checks ?? [];
}

interface AdminUserAvatarCardProps {
  email: string;
  name: string;
}

export function AdminUserAvatarCard({ email, name }: AdminUserAvatarCardProps) {
  const [state, setState] = useState<AdminUserAvatar | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removeNote, setRemoveNote] = useState('');

  const load = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        setState(await getAdminUserAvatar(email));
        setLoadError(null);
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Could not load the public picture.'
        );
      } finally {
        setLoading(false);
      }
    },
    [email]
  );

  useEffect(() => {
    let active = true;
    void getAdminUserAvatar(email).then(
      (next) => {
        if (!active) return;
        setState(next);
        setLoadError(null);
        setLoading(false);
      },
      (error: unknown) => {
        if (!active) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Could not load the public picture.'
        );
        setLoading(false);
      }
    );
    return () => {
      active = false;
    };
  }, [email]);

  async function decide(
    review: PublicAvatarReview,
    action: 'approve' | 'reject'
  ) {
    if (busy) return;
    setBusy(true);
    try {
      await decideAdminAvatarReview(review.id, action);
      toast.success(
        action === 'approve'
          ? 'The picture is now published.'
          : 'The review was rejected.'
      );
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not update the review.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      await deleteAdminUserAvatar(email, removeNote);
      setConfirmRemove(false);
      setRemoveNote('');
      toast.success('The public picture was removed.');
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not remove the public picture.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Public Picture</CardTitle>
            <CardDescription>
              Manage the picture shown in the People directory. Every change is
              recorded with the acting administrator.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || busy}
            onClick={() => void load(true)}
          >
            <RefreshCw />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Loading public picture…
          </p>
        ) : loadError ? (
          <p
            className="text-destructive-surface-foreground text-sm"
            role="alert"
          >
            {loadError}
          </p>
        ) : state ? (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <div
                className="bg-muted size-24 overflow-hidden rounded-full border"
                aria-label="Current public picture"
              >
                {state.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={state.url}
                    alt={`${name || state.username} public picture`}
                    className="size-full object-cover"
                  />
                ) : (
                  <div
                    className="text-muted-foreground flex size-full items-center
                      justify-center"
                  >
                    <ImageIcon className="size-7" aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium">@{state.username}</p>
                <p className="text-muted-foreground text-sm">
                  {state.url
                    ? 'A public picture is currently published.'
                    : 'No public picture is published.'}
                </p>
              </div>
              {state.url ? (
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() => setConfirmRemove(true)}
                >
                  <Trash2 />
                  Remove picture
                </Button>
              ) : null}
            </div>

            <Separator />

            <section
              className="space-y-3"
              aria-labelledby="avatar-reviews-heading"
            >
              <div className="flex items-center justify-between gap-3">
                <h3
                  id="avatar-reviews-heading"
                  className="text-sm font-semibold"
                >
                  Reviews awaiting approval
                </h3>
                <Badge variant="outline">{state.pending.length}</Badge>
              </div>
              {state.pending.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No pictures are waiting for review.
                </p>
              ) : (
                <ul className="space-y-3">
                  {state.pending.map((review) => (
                    <li
                      key={review.id}
                      className="flex flex-col gap-3 rounded-md border p-3
                        sm:flex-row"
                    >
                      <AdminAvatarReviewImage
                        reviewId={review.id}
                        alt="Picture awaiting review"
                        className="bg-muted size-28 shrink-0 rounded-md
                          object-cover"
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <p
                          className="text-muted-foreground flex items-center
                            gap-1 text-xs"
                        >
                          <Clock3 className="size-3" aria-hidden="true" />
                          Submitted {formatTime(review.submittedAt)}
                        </p>
                        <ul className="flex flex-wrap gap-2 text-xs">
                          {reviewChecks(review).map((check) => (
                            <li key={check.id}>
                              <Badge
                                variant="outline"
                                className={
                                  check.status === 'passed'
                                    ? `border-success-border bg-success-surface
                                      text-success-surface-foreground`
                                    : check.status === 'failed'
                                      ? `border-destructive-border
                                        bg-destructive-surface
                                        text-destructive-surface-foreground`
                                      : `border-warning-border
                                        bg-warning-surface
                                        text-warning-surface-foreground`
                                }
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
                            size="sm"
                            disabled={busy}
                            onClick={() => void decide(review, 'approve')}
                          >
                            <Check />
                            Allow and publish
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            disabled={busy}
                            onClick={() => void decide(review, 'reject')}
                          >
                            <X />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Separator />

            <section
              className="space-y-3"
              aria-labelledby="avatar-history-heading"
            >
              <h3 id="avatar-history-heading" className="text-sm font-semibold">
                Change history
              </h3>
              {state.history.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No public picture changes have been recorded.
                </p>
              ) : (
                <ol className="space-y-2">
                  {state.history.map((entry) => (
                    <li
                      key={entry.id}
                      className="bg-muted/40 rounded-md border px-3 py-2
                        text-sm"
                    >
                      <div
                        className="flex flex-wrap items-center justify-between
                          gap-2"
                      >
                        <span className="font-medium">
                          {ACTION_LABEL[entry.action]}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {formatTime(entry.createdAt)}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {entry.actorKind === 'admin' ? 'Admin' : 'Owner'}:{' '}
                        {entry.actorEmail}
                      </p>
                      {entry.note ? (
                        <p className="text-muted-foreground text-xs">
                          Note: {entry.note}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        ) : null}
      </CardContent>

      <Dialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this public picture?</DialogTitle>
            <DialogDescription>
              The People directory will show initials instead. The owner and the
              audit history will show that an administrator removed it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="avatar-remove-note">Reason (optional)</Label>
            <Input
              id="avatar-remove-note"
              value={removeNote}
              onChange={(event) => setRemoveNote(event.target.value)}
              maxLength={500}
              disabled={busy}
              placeholder="Why is this picture being removed?"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmRemove(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => void remove()}
            >
              <Trash2 />
              Remove picture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
