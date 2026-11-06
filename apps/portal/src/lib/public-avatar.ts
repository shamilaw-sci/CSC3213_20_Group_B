import {
  type PublicAvatar,
  type PublicAvatarDeleteResult,
  PublicAvatarDeleteResultSchema,
  PublicAvatarErrorSchema,
  type PublicAvatarModeration,
  type PublicAvatarQuota,
  PublicAvatarSchema,
  type PublicAvatarUploadResult,
  PublicAvatarUploadResultSchema,
} from '@scs/schemas';

import { apiHeaders, apiUrl, readApiError } from '@/lib/api';

const PUBLIC_AVATAR_ENDPOINT = '/api/people/v2/avatars/me';
export const MAX_PUBLIC_AVATAR_BYTES = 4 * 1024 * 1024;
export const PUBLIC_AVATAR_MAX_SIDE = 4096;
export const PUBLIC_AVATAR_MIN_SIDE = 280;
export const PUBLIC_AVATAR_MAX_PIXELS = 12_000_000;
const ACCEPTED_PUBLIC_AVATAR_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type PublicAvatarPreviewStyle = 'circle' | 'square' | 'rounded';

export interface PendingPublicAvatar {
  file: File;
  url: string;
}

export type PublicAvatarAnalysis =
  | { kind: 'idle' }
  | { fileName: string; kind: 'analyzing' }
  | {
      fileName: string;
      kind: 'approved';
      moderation?: PublicAvatarModeration;
      url: string;
    }
  | {
      kind: 'rejected';
      message: string;
      moderation?: PublicAvatarModeration;
    }
  | {
      kind: 'review_required';
      message: string;
      moderation?: PublicAvatarModeration;
    }
  | {
      kind: 'unavailable';
      message: string;
      moderation?: PublicAvatarModeration;
    }
  | {
      kind: 'rate_limited';
      message: string;
      quota?: PublicAvatarQuota;
      retryAfterSeconds?: number;
    }
  | { code?: string; kind: 'error'; message: string; retryable: boolean };

export class PublicAvatarRequestError extends Error {
  readonly code?: string;
  readonly moderation?: PublicAvatarModeration;
  readonly quota?: PublicAvatarQuota;
  readonly retryAfterSeconds?: number;
  readonly status: number;

  constructor(
    message: string,
    status: number,
    details: {
      code?: string;
      moderation?: PublicAvatarModeration;
      quota?: PublicAvatarQuota;
      retryAfterSeconds?: number;
    } = {}
  ) {
    super(message);
    this.name = 'PublicAvatarRequestError';
    this.status = status;
    this.code = details.code;
    this.moderation = details.moderation;
    this.quota = details.quota;
    this.retryAfterSeconds = details.retryAfterSeconds;
  }
}

function endpoint() {
  return apiUrl(PUBLIC_AVATAR_ENDPOINT).toString();
}

function retryAfterSeconds(response: Response): number | undefined {
  const header = response.headers.get('Retry-After')?.trim();
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(header);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

async function structuredError(response: Response) {
  const body = (await response
    .clone()
    .json()
    .catch(() => null)) as unknown;
  const parsed = PublicAvatarErrorSchema.safeParse(body);
  if (!parsed.success) {
    const fallback = await readApiError(response);
    return new PublicAvatarRequestError(
      fallback.message ?? fallback.error ?? 'Avatar request failed',
      response.status,
      {
        retryAfterSeconds: retryAfterSeconds(response),
      }
    );
  }
  const details = parsed.data;
  const message =
    details.message?.trim() || details.error?.trim() || 'Avatar request failed';
  return new PublicAvatarRequestError(message, response.status, {
    code: details.code,
    moderation: details.moderation,
    quota: details.quota,
    retryAfterSeconds: retryAfterSeconds(response),
  });
}

export function validatePublicAvatarFile(file: File): string | null {
  const type = file.type.toLowerCase();
  if (!(ACCEPTED_PUBLIC_AVATAR_TYPES as readonly string[]).includes(type))
    return 'Choose a JPEG, PNG, or WebP image.';
  if (file.size === 0) return 'This image file is empty.';
  if (file.size > MAX_PUBLIC_AVATAR_BYTES)
    return 'Choose an image smaller than 4 MiB.';
  return null;
}

export function isSamePublicAvatarSelection(a: File, b: File): boolean {
  return (
    a.name === b.name &&
    a.size === b.size &&
    a.type === b.type &&
    a.lastModified === b.lastModified
  );
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) {
    const kib = bytes / 1024;
    return `${Number.isInteger(kib) ? kib : kib.toFixed(1)} KiB`;
  }
  const mib = bytes / (1024 * 1024);
  return `${Number.isInteger(mib) ? mib : mib.toFixed(1)} MiB`;
}

export function formatResetTime(
  iso: string,
  now = Date.now()
): { relative: string; time: string } | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const time = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
  const remainingMs = date.getTime() - now;
  if (remainingMs <= 0) return { relative: 'now', time };
  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const relative =
    hours > 0
      ? `${hours} hr${minutes ? ` ${minutes} min` : ''}`
      : `${totalMinutes} min`;
  return { relative: `in ${relative}`, time };
}

export function formatRetryAfter(seconds: number | undefined): string | null {
  if (seconds === undefined || !Number.isFinite(seconds)) return null;
  if (seconds <= 0) return 'now';
  const totalMinutes = Math.ceil(seconds / 60);
  if (totalMinutes < 60) return `in ${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `in ${hours} hr${minutes ? ` ${minutes} min` : ''}`;
}

export function quotaUsedPercent(quota: PublicAvatarQuota): number {
  if (quota.limit <= 0) return 0;
  return Math.min(100, Math.max(0, (quota.used / quota.limit) * 100));
}

const CHECK_LABELS = {
  safety: 'Safety check',
  portrait: 'Portrait suitability',
} as const;

export function moderationCheckLabel(
  check: PublicAvatarModeration['checks'][number]
): string {
  return CHECK_LABELS[check.id];
}

export function moderationRecommendations(
  moderation: PublicAvatarModeration
): string[] {
  if (moderation.status === 'rejected') {
    const failed = new Set(
      moderation.checks
        .filter((check) => check.status === 'failed')
        .map((check) => check.id)
    );
    const recommendations: string[] = [];
    if (failed.has('safety'))
      recommendations.push(
        'Choose an image without nudity, graphic violence, hate symbols, or offensive gestures.'
      );
    if (failed.has('portrait'))
      recommendations.push(
        'Use a clear, well-lit photo that shows one person’s face.',
        'Avoid screenshots, memes, logos, and pictures with several people.'
      );
    return recommendations.length
      ? recommendations
      : ['Choose a different JPEG, PNG, or WebP image.'];
  }
  if (moderation.status === 'review_required')
    return [
      'Try a sharper portrait with an unobstructed, clearly visible face.',
      'If a clear portrait is still not accepted, contact an administrator.',
    ];
  return ['Try again with a clear portrait, or choose a different image.'];
}

export async function getMyPublicAvatar(): Promise<PublicAvatar> {
  const response = await fetch(endpoint(), {
    cache: 'no-store',
    credentials: 'include',
    headers: apiHeaders(),
  });
  if (!response.ok) throw await structuredError(response);
  const parsed = PublicAvatarSchema.safeParse(await response.json());
  if (!parsed.success)
    throw new PublicAvatarRequestError(
      'Received an unexpected response from the avatar service.',
      response.status
    );
  return parsed.data;
}

export async function uploadMyPublicAvatar(
  file: File
): Promise<PublicAvatarUploadResult> {
  const form = new FormData();
  form.append('image', file);
  const response = await fetch(endpoint(), {
    method: 'POST',
    credentials: 'include',
    headers: apiHeaders(),
    body: form,
  });
  if (!response.ok) throw await structuredError(response);
  const parsed = PublicAvatarUploadResultSchema.safeParse(
    await response.json()
  );
  if (!parsed.success)
    throw new PublicAvatarRequestError(
      'The picture was uploaded, but the response could not be read. Reload the page to confirm the published picture.',
      response.status
    );
  return parsed.data;
}

export async function deleteMyPublicAvatar(): Promise<PublicAvatarDeleteResult> {
  const response = await fetch(endpoint(), {
    method: 'DELETE',
    credentials: 'include',
    headers: apiHeaders(),
  });
  if (!response.ok) throw await structuredError(response);
  const parsed = PublicAvatarDeleteResultSchema.safeParse(
    await response.json()
  );
  if (!parsed.success)
    throw new PublicAvatarRequestError(
      'The picture was removed, but the response could not be read. Reload the page to confirm.',
      response.status
    );
  return parsed.data;
}
