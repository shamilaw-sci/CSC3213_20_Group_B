'use client';

import { LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { fetchAdminAvatarReviewImage } from '@/lib/admin-avatar';

interface AdminAvatarReviewImageProps {
  alt: string;
  className?: string;
  reviewId: string;
}

export function AdminAvatarReviewImage({
  alt,
  className,
  reviewId,
}: AdminAvatarReviewImageProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    void fetchAdminAvatarReviewImage(reviewId).then(
      (blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      },
      () => {
        if (active) setFailed(true);
      }
    );
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [reviewId]);

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={alt} className={className} />
    );
  }

  return (
    <div
      className={`bg-muted text-muted-foreground flex items-center
        justify-center ${className ?? ''}`}
      aria-busy={!failed}
      aria-label={failed ? 'Review image unavailable' : 'Loading review image'}
    >
      {failed ? (
        <span className="text-xs">Unavailable</span>
      ) : (
        <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
      )}
    </div>
  );
}
