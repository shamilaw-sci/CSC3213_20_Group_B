'use client';

import {
  Image as ImageIcon,
  Ruler,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

import {
  formatFileSize,
  MAX_PUBLIC_AVATAR_BYTES,
  PUBLIC_AVATAR_MAX_PIXELS,
  PUBLIC_AVATAR_MAX_SIDE,
  PUBLIC_AVATAR_MIN_SIDE,
} from '@/lib/public-avatar';

export function PublicAvatarGuidelines() {
  return (
    <section className="space-y-4" aria-labelledby="avatar-guidelines-heading">
      <div className="space-y-1">
        <h2 id="avatar-guidelines-heading" className="text-base font-semibold">
          Picture requirements
        </h2>
        <p className="text-muted-foreground text-sm">
          These are the same checks the server applies.
        </p>
      </div>
      <ul className="space-y-4 text-sm">
        <li className="flex gap-3">
          <UserRound aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="block font-medium">One person</span>
            <span className="text-muted-foreground text-sm/6">
              Use a clear portrait with a reasonably visible face.
            </span>
          </span>
        </li>
        <li className="flex gap-3">
          <ImageIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="block font-medium">Accepted files</span>
            <span className="text-muted-foreground text-sm/6">
              JPEG, PNG, or WebP, up to{' '}
              {formatFileSize(MAX_PUBLIC_AVATAR_BYTES)}.
            </span>
          </span>
        </li>
        <li className="flex gap-3">
          <Ruler aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="block font-medium">Size limits</span>
            <span className="text-muted-foreground text-sm/6">
              At least {PUBLIC_AVATAR_MIN_SIDE} × {PUBLIC_AVATAR_MIN_SIDE} px
              and at most {PUBLIC_AVATAR_MAX_SIDE} px per side, up to{' '}
              {PUBLIC_AVATAR_MAX_PIXELS / 1_000_000} megapixels.
            </span>
          </span>
        </li>
        <li className="flex gap-3">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="block font-medium">Automatic check</span>
            <span className="text-muted-foreground text-sm/6">
              Pictures are checked for safety and portrait suitability before
              they are published.
            </span>
          </span>
        </li>
      </ul>
      <p className="text-muted-foreground border-t pt-4 text-xs/5">
        This picture is separate from your private account picture and does not
        use a public profile pull request.
      </p>
    </section>
  );
}
