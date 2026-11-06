'use client';

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
import { Image as ImageIcon, LoaderCircle, Trash2, Upload } from 'lucide-react';
import { type RefObject, useState } from 'react';

import { formatFileSize, type PendingPublicAvatar } from '@/lib/public-avatar';

interface PublicAvatarUploadControlsProps {
  busy: boolean;
  canUpload: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onCancel: () => void;
  onRemove: () => void;
  onSelect: (file: File) => void;
  onUpload: () => void;
  pending: PendingPublicAvatar | null;
  publishedUrl: string | null;
  quotaAvailable: boolean | null;
}

export function PublicAvatarUploadControls({
  busy,
  canUpload,
  fileInputRef,
  onCancel,
  onRemove,
  onSelect,
  onUpload,
  pending,
  publishedUrl,
  quotaAvailable,
}: PublicAvatarUploadControlsProps) {
  const [confirmRemove, setConfirmRemove] = useState(false);

  return (
    <section className="space-y-4" aria-labelledby="avatar-upload-heading">
      <div className="space-y-1">
        <h2 id="avatar-upload-heading" className="text-base font-semibold">
          {pending ? 'Selected picture' : 'Choose a picture'}
        </h2>
        <p className="text-muted-foreground text-sm">
          {pending
            ? 'Review the preview, then upload it for the automatic check.'
            : 'Select a JPEG, PNG, or WebP image. You can preview it before uploading.'}
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        name="image"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onSelect(file);
        }}
      />

      {pending ? (
        <div
          className="border-warning-border bg-warning-surface/60 flex flex-wrap
            items-center gap-3 rounded-lg border p-3"
        >
          <ImageIcon
            aria-hidden="true"
            className="text-warning-surface-foreground size-5 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{pending.file.name}</p>
            <p className="text-muted-foreground text-xs">
              {formatFileSize(pending.file.size)} · Preview only
            </p>
          </div>
          <Badge variant="outline" className="bg-background/70">
            Not published
          </Badge>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {pending ? (
          <>
            <Button
              type="button"
              disabled={busy || !canUpload}
              onClick={onUpload}
            >
              {busy ? <LoaderCircle className="animate-spin" /> : <Upload />}
              {busy ? 'Uploading…' : 'Upload and analyze'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              Choose a different picture
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={onCancel}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              {publishedUrl ? 'Replace picture' : 'Choose picture'}
            </Button>
            {publishedUrl ? (
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
          </>
        )}
      </div>

      {quotaAvailable === false ? (
        <p
          className="border-warning-border bg-warning-surface
            text-warning-surface-foreground rounded-md border p-3 text-sm"
        >
          Uploading is unavailable until the hourly limit resets. You can still
          select and preview a picture now.
        </p>
      ) : null}

      <Dialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove your public picture?</DialogTitle>
            <DialogDescription>
              People will see your initials in the directory instead. Your
              private account picture and public profile are not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmRemove(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setConfirmRemove(false);
                onRemove();
              }}
            >
              Remove picture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
