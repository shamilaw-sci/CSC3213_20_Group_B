'use client';

import type { AdminUserAvatar } from '@scs/schemas';
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
  Image as ImageIcon,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { BackButton } from '@/components/navigation/back-button';
import { deleteAdminUserAvatar, getAdminUserAvatar } from '@/lib/admin-avatar';

interface AdminUserPublicAvatarPageProps {
  backHref: string;
  email: string;
  name: string;
}

export function AdminUserPublicAvatarPage({
  backHref,
  email,
  name,
}: AdminUserPublicAvatarPageProps) {
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
    <PageShell>
      <BackButton
        fallbackHref={backHref}
        label="Back to Public Profile"
        preferFallback
      />
      <PageHeader
        title="Public picture"
        description={`View or remove the picture shown for ${name || email} in the People directory. Administrators cannot upload a replacement here.`}
        action={
          <Button
            type="button"
            variant="outline"
            disabled={loading || busy}
            onClick={() => void load(true)}
          >
            <RefreshCw />
            Refresh
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Current public picture</CardTitle>
              <CardDescription>
                The owner manages uploads from their own public picture page. An
                administrator can remove the published picture; the removal is
                recorded in the audit history.
              </CardDescription>
            </div>
            {state?.url ? (
              <Badge variant="outline">Published</Badge>
            ) : (
              <Badge variant="outline">No picture</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
              Loading public picture...
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
              <div className="flex flex-col items-start gap-5 sm:flex-row">
                <div
                  className="bg-muted size-40 shrink-0 overflow-hidden
                    rounded-2xl border"
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
                      className="text-muted-foreground flex size-full
                        items-center justify-center"
                    >
                      <ImageIcon className="size-9" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm font-medium">@{state.username}</p>
                  <p className="text-muted-foreground text-sm">
                    {state.url
                      ? 'This picture is currently published in the People directory.'
                      : 'No public picture is currently published. The directory shows initials.'}
                  </p>
                  {state.pending.length ? (
                    <p className="text-muted-foreground text-sm">
                      {state.pending.length === 1
                        ? 'One candidate picture is awaiting review.'
                        : `${state.pending.length} candidate pictures are awaiting review.`}{' '}
                      <Link
                        href="/admin/avatar-reviews"
                        className="underline underline-offset-4"
                      >
                        Open the review queue
                      </Link>
                      .
                    </p>
                  ) : null}
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
              </div>

              <Separator />

              <div className="flex items-start gap-3 rounded-lg border p-3">
                <ShieldCheck
                  aria-hidden="true"
                  className="text-muted-foreground mt-0.5 size-5 shrink-0"
                />
                <p className="text-muted-foreground text-sm">
                  This page is intentionally remove-only. Use the member&apos;s
                  user overview to approve or reject pending candidates.
                </p>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

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
            <Label htmlFor="public-avatar-remove-note">Reason (optional)</Label>
            <Input
              id="public-avatar-remove-note"
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
    </PageShell>
  );
}
