'use client';

import { Badge } from '@scs/ui/components/badge';
import { Button } from '@scs/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@scs/ui/components/dialog';
import { ToggleGroup, ToggleGroupItem } from '@scs/ui/components/toggle-group';
import { cn } from 'cn';
import { Maximize2, UserRound } from 'lucide-react';
import { useState } from 'react';

import type { PublicAvatarPreviewStyle } from '@/lib/public-avatar';

const styleClasses: Record<PublicAvatarPreviewStyle, string> = {
  circle: 'rounded-full',
  square: 'rounded-none',
  rounded: 'rounded-2xl',
};

const styleLabels: Record<PublicAvatarPreviewStyle, string> = {
  circle: 'Circle',
  square: 'Square',
  rounded: 'Rounded',
};

const styleDescriptions: Record<PublicAvatarPreviewStyle, string> = {
  circle: 'How the picture appears in the People directory.',
  square: 'The full square crop of the picture.',
  rounded: 'A softer crop for cards and other layouts.',
};

interface PreviewVisualProps {
  alt: string;
  className?: string;
  imageUrl: string | null;
  initial: string;
}

function PreviewVisual({
  alt,
  className,
  imageUrl,
  initial,
}: PreviewVisualProps) {
  if (imageUrl)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Preview URLs may be local blobs that Next Image cannot optimize.
      <img
        src={imageUrl}
        alt={alt}
        draggable={false}
        className={cn('size-full object-cover', className)}
      />
    );
  return (
    <div
      role="img"
      aria-label={alt}
      className={cn(
        `bg-muted text-muted-foreground flex size-full flex-col items-center
        justify-center gap-3`,
        className
      )}
    >
      <UserRound aria-hidden="true" className="size-10 opacity-60" />
      <span className="text-4xl font-semibold" aria-hidden="true">
        {initial}
      </span>
      <span className="text-xs" aria-hidden="true">
        No picture
      </span>
    </div>
  );
}

type PublicAvatarPendingKind = 'review' | 'selection';

interface PublicAvatarPreviewProps {
  onStyleChange: (style: PublicAvatarPreviewStyle) => void;
  pendingFileName: string | null;
  pendingKind: PublicAvatarPendingKind | null;
  pendingUrl: string | null;
  publishedUrl: string | null;
  style: PublicAvatarPreviewStyle;
  username: string | null;
}

export function PublicAvatarPreview({
  onStyleChange,
  pendingFileName,
  pendingKind,
  pendingUrl,
  publishedUrl,
  style,
  username,
}: PublicAvatarPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const imageUrl = pendingUrl ?? publishedUrl;
  const initial = username?.trim().charAt(0).toUpperCase() || '?';
  const reviewing = pendingKind === 'review';
  const alt = pendingUrl
    ? reviewing
      ? 'Picture waiting for administrator review'
      : `Unsaved preview of ${pendingFileName ?? 'your selected picture'}`
    : publishedUrl
      ? 'Your published public picture'
      : 'No public picture selected';
  const comparing = Boolean(pendingUrl && publishedUrl);

  return (
    <section className="space-y-5" aria-labelledby="avatar-preview-heading">
      <div
        className="flex flex-col gap-3 sm:flex-row sm:items-start
          sm:justify-between"
      >
        <div className="space-y-1">
          <h2 id="avatar-preview-heading" className="text-base font-semibold">
            Picture preview
          </h2>
          <p className="text-muted-foreground text-sm">
            Preview styles only change how the same picture is displayed.
          </p>
        </div>
        <ToggleGroup
          aria-label="Preview style"
          variant="outline"
          size="sm"
          spacing={0}
          value={[style]}
          onValueChange={(value) => {
            const next = value[0];
            if (next === 'circle' || next === 'square' || next === 'rounded')
              onStyleChange(next);
          }}
        >
          <ToggleGroupItem value="circle">
            <span
              aria-hidden="true"
              className="size-4 rounded-full border-2 border-current"
            />
            {styleLabels.circle}
          </ToggleGroupItem>
          <ToggleGroupItem value="square">
            <span
              aria-hidden="true"
              className="size-4 rounded-none border-2 border-current"
            />
            {styleLabels.square}
          </ToggleGroupItem>
          <ToggleGroupItem value="rounded">
            <span
              aria-hidden="true"
              className="size-4 rounded-[5px] border-2 border-current"
            />
            {styleLabels.rounded}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="space-y-3">
        <div className="flex min-h-6 items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs">
            {styleDescriptions[style]}
          </p>
          {pendingUrl ? (
            <Badge
              variant="outline"
              className="border-warning-border bg-warning-surface
                text-warning-surface-foreground"
            >
              {reviewing ? 'In review' : 'Unsaved preview'}
            </Badge>
          ) : publishedUrl ? (
            <Badge
              variant="outline"
              className="border-success-border bg-success-surface
                text-success-surface-foreground"
            >
              Published
            </Badge>
          ) : (
            <Badge variant="outline">No picture yet</Badge>
          )}
        </div>

        {comparing ? null : (
          <div
            className={cn(
              `bg-muted relative mx-auto aspect-square w-full max-w-lg
                overflow-hidden border`,
              styleClasses[style]
            )}
          >
            <PreviewVisual alt={alt} imageUrl={imageUrl} initial={initial} />
          </div>
        )}

        {comparing ? (
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <figure className="space-y-2">
              <div
                className={cn(
                  `bg-muted relative aspect-square w-full overflow-hidden
                    border`,
                  styleClasses[style]
                )}
              >
                <PreviewVisual
                  alt="Your currently published public picture"
                  imageUrl={publishedUrl}
                  initial={initial}
                />
              </div>
              <figcaption
                className="text-muted-foreground text-center text-xs
                  font-medium"
              >
                Currently published
              </figcaption>
            </figure>
            <figure className="space-y-2">
              <div
                className={cn(
                  `bg-muted relative aspect-square w-full overflow-hidden
                    border`,
                  styleClasses[style]
                )}
              >
                <PreviewVisual
                  alt={alt}
                  imageUrl={pendingUrl}
                  initial={initial}
                />
              </div>
              <figcaption
                className="text-muted-foreground text-center text-xs
                  font-medium"
              >
                {reviewing ? 'Awaiting review' : 'Selected preview'}
              </figcaption>
            </figure>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!imageUrl}
            onClick={() => setExpanded(true)}
          >
            <Maximize2 />
            Expand preview
          </Button>
        </div>

        <p className="text-muted-foreground text-center text-xs">
          {reviewing
            ? 'The published picture stays live while an administrator reviews the candidate. You can change or withdraw the candidate below.'
            : comparing
              ? 'The published picture stays live in the People directory until the selected preview is accepted.'
              : pendingUrl
                ? 'Your selected preview is not published until it passes the automatic check.'
                : publishedUrl
                  ? 'This is the picture people see in the People directory.'
                  : 'Choose a picture below to preview it here before publishing.'}
        </p>
      </div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Picture preview</DialogTitle>
            <DialogDescription>
              {pendingUrl
                ? reviewing
                  ? 'This picture is waiting for administrator review and has not been published.'
                  : 'This selected picture has not been published yet.'
                : 'This is your current published public picture.'}
            </DialogDescription>
          </DialogHeader>
          <div
            className={cn(
              `bg-muted mx-auto aspect-square w-full max-w-md overflow-hidden
              border`,
              styleClasses[style]
            )}
          >
            <PreviewVisual alt={alt} imageUrl={imageUrl} initial={initial} />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
