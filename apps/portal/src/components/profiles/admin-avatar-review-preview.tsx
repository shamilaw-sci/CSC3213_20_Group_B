'use client';

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
import { Maximize2 } from 'lucide-react';
import { useState } from 'react';

import { AdminAvatarReviewImage } from '@/components/profiles/admin-avatar-review-image';
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

interface AdminAvatarReviewPreviewProps {
  alt: string;
  className?: string;
  reviewId: string;
  username: string;
}

export function AdminAvatarReviewPreview({
  alt,
  className,
  reviewId,
  username,
}: AdminAvatarReviewPreviewProps) {
  const [style, setStyle] = useState<PublicAvatarPreviewStyle>('circle');
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-2">
      <div
        className={cn(
          'bg-muted relative overflow-hidden border',
          styleClasses[style],
          className
        )}
      >
        <AdminAvatarReviewImage
          reviewId={reviewId}
          alt={alt}
          className="size-full object-cover"
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <ToggleGroup
          aria-label={`Preview style for ${username}'s picture`}
          variant="outline"
          size="sm"
          spacing={0}
          value={[style]}
          onValueChange={(value) => {
            const next = value[0];
            if (next === 'circle' || next === 'square' || next === 'rounded')
              setStyle(next);
          }}
        >
          <ToggleGroupItem value="circle">
            <span
              aria-hidden="true"
              className="size-3 rounded-full border-2 border-current"
            />
            {styleLabels.circle}
          </ToggleGroupItem>
          <ToggleGroupItem value="square">
            <span
              aria-hidden="true"
              className="size-3 rounded-none border-2 border-current"
            />
            {styleLabels.square}
          </ToggleGroupItem>
          <ToggleGroupItem value="rounded">
            <span
              aria-hidden="true"
              className="size-3 rounded-[4px] border-2 border-current"
            />
            {styleLabels.rounded}
          </ToggleGroupItem>
        </ToggleGroup>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(true)}
        >
          <Maximize2 />
          Expand
        </Button>
      </div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Picture review preview</DialogTitle>
            <DialogDescription>
              Candidate submitted by @{username}. It is not published until an
              administrator approves it.
            </DialogDescription>
          </DialogHeader>
          <div
            className={cn(
              `bg-muted mx-auto aspect-square w-full max-w-md overflow-hidden
              border`,
              styleClasses[style]
            )}
          >
            <AdminAvatarReviewImage
              reviewId={reviewId}
              alt={alt}
              className="size-full object-cover"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
