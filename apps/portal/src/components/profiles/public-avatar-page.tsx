'use client';

import type { PublicAvatar } from '@scs/schemas';
import { Button } from '@scs/ui/components/button';
import { Card, CardContent } from '@scs/ui/components/card';
import { Separator } from '@scs/ui/components/separator';
import { LoaderCircle, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { BackButton } from '@/components/navigation/back-button';
import { PublicAvatarAnalysisPanel } from '@/components/profiles/public-avatar/public-avatar-analysis';
import { PublicAvatarGuidelines } from '@/components/profiles/public-avatar/public-avatar-guidelines';
import { PublicAvatarPreview } from '@/components/profiles/public-avatar/public-avatar-preview';
import { PublicAvatarUploadControls } from '@/components/profiles/public-avatar/public-avatar-upload-controls';
import { PublicAvatarUsage } from '@/components/profiles/public-avatar/public-avatar-usage';
import {
  deleteMyPublicAvatar,
  getMyPublicAvatar,
  isSamePublicAvatarSelection,
  type PendingPublicAvatar,
  type PublicAvatarAnalysis,
  type PublicAvatarPreviewStyle,
  PublicAvatarRequestError,
  uploadMyPublicAvatar,
  validatePublicAvatarFile,
} from '@/lib/public-avatar';

type LoadMode = 'initial' | 'quiet' | 'notify';

function messageFor(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function PublicAvatarPage() {
  const [current, setCurrent] = useState<PublicAvatar | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingPublicAvatar | null>(null);
  const [analysis, setAnalysis] = useState<PublicAvatarAnalysis>({
    kind: 'idle',
  });
  const [previewStyle, setPreviewStyle] =
    useState<PublicAvatarPreviewStyle>('circle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!pending?.url) return;
    const url = pending.url;
    return () => URL.revokeObjectURL(url);
  }, [pending]);

  const load = useCallback(async (mode: LoadMode = 'initial') => {
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    try {
      const next = await getMyPublicAvatar();
      if (!mountedRef.current) return;
      setCurrent(next);
      setLoadError(null);
      if (mode === 'notify') toast.success('Upload usage refreshed.');
    } catch (error) {
      if (!mountedRef.current) return;
      const message = messageFor(error, 'Could not load your public picture.');
      if (mode === 'initial') setLoadError(message);
      if (mode === 'notify') toast.error(message);
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load('initial');
  }, [load]);

  const resetsAt = current?.quota?.resetsAt;
  useEffect(() => {
    if (!resetsAt) return;
    const resetTime = Date.parse(resetsAt);
    if (Number.isNaN(resetTime)) return;
    const delay = Math.max(1000, resetTime - Date.now() + 1500);
    const timeout = window.setTimeout(
      () => void load('quiet'),
      Math.min(delay, 2_147_000_000)
    );
    return () => window.clearTimeout(timeout);
  }, [load, resetsAt]);

  function selectFile(file: File) {
    if (pending && isSamePublicAvatarSelection(pending.file, file)) {
      toast.info('That picture is already selected.');
      return;
    }
    const validation = validatePublicAvatarFile(file);
    if (validation) {
      setAnalysis({ kind: 'error', message: validation, retryable: false });
      return;
    }
    setPending({ file, url: URL.createObjectURL(file) });
    setAnalysis({ kind: 'idle' });
  }

  function cancelPending() {
    setPending(null);
    setAnalysis({ kind: 'idle' });
  }

  const handleUploadError = useCallback((error: unknown) => {
    if (error instanceof PublicAvatarRequestError) {
      if (error.quota)
        setCurrent((previous) =>
          previous ? { ...previous, quota: error.quota } : previous
        );
      if (error.status === 429 || error.code === 'avatar_rate_limited') {
        setAnalysis({
          kind: 'rate_limited',
          message: error.message,
          quota: error.quota,
          retryAfterSeconds: error.retryAfterSeconds,
        });
        return;
      }
      if (error.code === 'avatar_moderation_rejected') {
        setAnalysis({
          kind: 'rejected',
          message: error.message,
          moderation: error.moderation,
        });
        return;
      }
      if (error.code === 'avatar_moderation_review_required') {
        setAnalysis({
          kind: 'review_required',
          message: error.message,
          moderation: error.moderation,
        });
        return;
      }
      if (
        error.code === 'avatar_moderation_unavailable' ||
        error.status === 503
      ) {
        setAnalysis({
          kind: 'unavailable',
          message: error.message,
          moderation: error.moderation,
        });
        return;
      }
      setAnalysis({
        kind: 'error',
        message: error.message,
        code: error.code,
        retryable: error.status >= 500 || error.status === 409,
      });
      return;
    }
    const message = messageFor(
      error,
      'The upload did not finish. Check your connection and try again.'
    );
    setAnalysis({ kind: 'error', message, retryable: true });
    toast.error(message);
  }, []);

  const submit = useCallback(async () => {
    if (!pending || busy) return;
    if (current?.quota && !current.quota.available) {
      setAnalysis({
        kind: 'rate_limited',
        message: 'You have used all upload attempts in this hour.',
        quota: current.quota,
        retryAfterSeconds: current.quota.retryAfterSeconds,
      });
      return;
    }
    const file = pending.file;
    setBusy(true);
    setAnalysis({ kind: 'analyzing', fileName: file.name });
    try {
      const result = await uploadMyPublicAvatar(file);
      if (!mountedRef.current) return;
      setCurrent((previous) => ({
        username: previous?.username ?? '',
        url: result.url,
        quota: result.quota ?? previous?.quota,
      }));
      setPending(null);
      setAnalysis({
        kind: 'approved',
        fileName: file.name,
        moderation: result.moderation,
        url: result.url,
      });
      toast.success('Your public picture is updated.');
    } catch (error) {
      if (!mountedRef.current) return;
      handleUploadError(error);
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [busy, current?.quota, handleUploadError, pending]);

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await deleteMyPublicAvatar();
      if (!mountedRef.current) return;
      setCurrent((previous) =>
        previous
          ? { ...previous, url: null, quota: result.quota ?? previous.quota }
          : previous
      );
      setPending(null);
      setAnalysis({ kind: 'idle' });
      toast.success('Your public picture is removed.');
    } catch (error) {
      if (!mountedRef.current) return;
      if (error instanceof PublicAvatarRequestError && error.quota)
        setCurrent((previous) =>
          previous ? { ...previous, quota: error.quota } : previous
        );
      toast.error(messageFor(error, 'Could not remove your public picture.'));
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  const quotaAvailable = current?.quota?.available ?? null;
  const canUpload = quotaAvailable !== false;
  const canRetry = canUpload && Boolean(pending) && !busy;

  return (
    <PageShell width="default">
      <BackButton
        fallbackHref="/user/me/public-profile"
        label="Back to Public Profile"
        preferFallback
      />
      <PageHeader
        title="Public picture"
        description="Manage the picture shown in the People directory. This does not change your private account picture or use a public profile pull request."
      />

      {loading ? (
        <Card>
          <CardContent
            className="space-y-3 py-12 text-center"
            aria-busy="true"
            aria-live="polite"
          >
            <LoaderCircle
              aria-hidden="true"
              className="text-muted-foreground mx-auto size-6 animate-spin"
            />
            <p className="text-muted-foreground text-sm">
              Loading your public picture…
            </p>
          </CardContent>
        </Card>
      ) : loadError || !current ? (
        <Card>
          <CardContent className="space-y-4 py-12 text-center" role="alert">
            <TriangleAlert
              aria-hidden="true"
              className="text-destructive mx-auto size-6"
            />
            <div className="space-y-1">
              <h2 className="text-base font-semibold">
                Could not load your public picture
              </h2>
              <p className="text-muted-foreground text-sm">
                {loadError ?? 'An unexpected response was received.'}
              </p>
            </div>
            <Button type="button" onClick={() => void load('initial')}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div
          className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]
            lg:items-start"
        >
          <div className="min-w-0 space-y-6">
            <Card>
              <CardContent className="space-y-8">
                <PublicAvatarPreview
                  onStyleChange={setPreviewStyle}
                  pendingFileName={pending?.file.name ?? null}
                  pendingUrl={pending?.url ?? null}
                  publishedUrl={current.url}
                  style={previewStyle}
                  username={current.username}
                />
                <Separator />
                <PublicAvatarUploadControls
                  busy={busy}
                  canUpload={canUpload}
                  fileInputRef={fileInputRef}
                  onCancel={cancelPending}
                  onRemove={() => void remove()}
                  onSelect={selectFile}
                  onUpload={() => void submit()}
                  pending={pending}
                  publishedUrl={current.url}
                  quotaAvailable={quotaAvailable}
                />
              </CardContent>
            </Card>

            <PublicAvatarAnalysisPanel
              analysis={analysis}
              canRetry={canRetry}
              onChooseAnother={() => fileInputRef.current?.click()}
              onDismiss={() => setAnalysis({ kind: 'idle' })}
              onRetry={() => void submit()}
            />
          </div>

          <aside className="space-y-6">
            <Card>
              <CardContent>
                <PublicAvatarUsage
                  onRefresh={() => void load('notify')}
                  quota={current.quota}
                  refreshing={refreshing}
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <PublicAvatarGuidelines />
              </CardContent>
            </Card>
          </aside>
        </div>
      )}
    </PageShell>
  );
}
