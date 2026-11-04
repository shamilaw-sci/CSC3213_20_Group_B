'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@scs/ui/components/avatar';
import { Button, buttonVariants } from '@scs/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@scs/ui/components/card';
import { useEffect, useState } from 'react';

import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { BackButton } from '@/components/navigation/back-button';
import { apiHeaders, apiUrl, readApiError } from '@/lib/api';

const endpoint = apiUrl('/api/people/v2/avatars/me').toString();
const maxUploadBytes = 4 * 1024 * 1024;

type AvatarState = { username: string; url: string | null };

export default function PublicAvatarPage() {
  const [avatar, setAvatar] = useState<AvatarState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    fetch(endpoint, { credentials: 'include', headers: apiHeaders() })
      .then(async (response) => {
        if (!response.ok)
          throw new Error((await readApiError(response)).message);
        const current = (await response.json()) as AvatarState;
        if (active) setAvatar(current);
      })
      .catch((error: unknown) => {
        if (active)
          setMessage(
            error instanceof Error
              ? error.message
              : 'Could not load your public picture'
          );
      });
    return () => {
      active = false;
    };
  }, []);

  async function upload(file: File) {
    if (file.size > maxUploadBytes) {
      setMessage('Choose an image smaller than 4 MiB.');
      return;
    }
    setBusy(true);
    setMessage('Checking your picture…');
    try {
      const form = new FormData();
      form.append('image', file);
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: apiHeaders(),
        body: form,
      });
      if (!response.ok) throw new Error((await readApiError(response)).message);
      const result = (await response.json()) as { url: string };
      setAvatar((current) =>
        current ? { ...current, url: result.url } : current
      );
      setMessage('Your public picture is updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setMessage('Removing your public picture…');
    try {
      const response = await fetch(endpoint, {
        method: 'DELETE',
        credentials: 'include',
        headers: apiHeaders(),
      });
      if (!response.ok) throw new Error((await readApiError(response)).message);
      setAvatar((current) => (current ? { ...current, url: null } : current));
      setMessage('Your public picture is removed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Removal failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell width="narrow">
      <BackButton
        fallbackHref="/user/me/public-profile"
        label="Back to Public Profile"
        preferFallback
      />
      <PageHeader
        title="Public picture"
        description="Manage the picture shown in the People directory. Changes appear without a profile PR."
      />
      <Card>
        <CardHeader>
          <CardTitle>Your People picture</CardTitle>
          <CardDescription>
            Upload a JPEG, PNG, or WebP image of one person, up to 4 MiB.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {avatar ? (
            <>
              <Avatar className="size-32">
                {avatar.url ? (
                  <AvatarImage src={avatar.url} alt="Your public picture" />
                ) : null}
                <AvatarFallback className="text-3xl">
                  {avatar.username.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-wrap items-center gap-3">
                <label
                  className={buttonVariants({
                    className: busy
                      ? 'pointer-events-none cursor-not-allowed opacity-50'
                      : 'cursor-pointer',
                  })}
                >
                  {busy
                    ? 'Working…'
                    : avatar.url
                      ? 'Replace picture'
                      : 'Upload picture'}
                  <input
                    className="sr-only"
                    type="file"
                    name="image"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void upload(file);
                      event.target.value = '';
                    }}
                  />
                </label>
                {avatar.url ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void remove()}
                  >
                    Remove picture
                  </Button>
                ) : null}
              </div>
            </>
          ) : !message ? (
            <p className="text-muted-foreground text-sm">
              Loading your public picture…
            </p>
          ) : null}
          {message ? (
            <p role="status" className="text-sm">
              {message}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </PageShell>
  );
}
