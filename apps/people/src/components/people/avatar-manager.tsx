'use client';

import { useEffect, useState } from 'react';

import publicEnvConfig from '@/config/public.env.config';

const endpoint = `${publicEnvConfig.NEXT_PUBLIC_API_BASE_URL}/api/people/v2/avatars/me`;

export function AvatarManager({
  username,
  onChange,
}: {
  username: string;
  onChange: (url: string) => void;
}) {
  const [owner, setOwner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    fetch(endpoint, { credentials: 'include' })
      .then(async (response) => {
        if (response.ok && active) {
          const data = (await response.json()) as { username?: string };
          setOwner(data.username === username);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [username]);
  if (!owner) return null;

  async function upload(file: File) {
    setBusy(true);
    setMessage('Checking and uploading image…');
    try {
      const form = new FormData();
      form.append('image', file);
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const result = (await response.json()) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !result.url)
        throw new Error(result.error ?? 'Upload failed');
      onChange(result.url);
      setMessage('Picture updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setMessage('Removing picture…');
    try {
      const response = await fetch(endpoint, {
        method: 'DELETE',
        credentials: 'include',
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Removal failed');
      onChange('');
      setMessage('Picture removed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Removal failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-2 text-sm">
      <label
        className="border-border hover:bg-muted inline-flex cursor-pointer
          rounded-md border px-3 py-2"
      >
        {busy ? 'Working…' : 'Upload or replace picture'}
        <input
          type="file"
          name="image"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = '';
          }}
        />
      </label>
      <button
        type="button"
        className="border-border hover:bg-muted ml-2 rounded-md border px-3
          py-2"
        disabled={busy}
        onClick={() => void remove()}
      >
        Remove picture
      </button>
      {message && (
        <p role="status" className="text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  );
}
