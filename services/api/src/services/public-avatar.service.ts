import type {
  PublicAvatarAuditAction,
  PublicAvatarAuditActorKind,
  PublicAvatarModeration,
  PublicAvatarQuota,
} from '@scs/schemas';
import {
  createAvatarModerator,
  createTypeSafeProvider,
} from '@scs/moderation/avatar';
import { type BinaryObjectStore } from '@scs/storage';
import { z } from 'zod';

import { avatarStore } from '@/config/avatar-storage';
import {
  createCorsHeaders,
  createJsonErrorResponse,
  createJsonResponse,
  createTextErrorResponse,
  getRequestOrigin,
} from '@/http/responses';
import {
  verifyIdentitySession,
  verifySessionRequest,
} from '@/middleware/session';
import {
  getPermissionRole,
  getUserPermission,
  isSuperAdmin,
} from '@/repositories/permissions.repo';
import {
  cancelPendingAvatarReviews,
  createAvatarReview,
  getAvatarReview,
  getPendingAvatarReviewForUser,
  hasPendingAvatarObject,
  listAvatarAudit,
  listPendingAvatarReviewsForUser,
  listPendingAvatarReviewPage,
  markAvatarReview,
  PUBLIC_AVATAR_AUDIT_ACTION,
  recordAvatarAudit,
  reopenAvatarReview,
  type PublicAvatarReviewCursor,
  type PublicAvatarReviewRecord,
} from '@/repositories/public-avatar.repo';
import {
  decodePaginationCursor,
  encodePaginationCursor,
  InvalidPaginationCursorError,
  parsePaginationRequest,
} from '@/pagination/cursor';
import type { Env } from '@/types/env';
import { isRecord } from '@/utils/is-record';

const ROOT = '/api/people/v2/avatars/';
const ADMIN_USERS = '/api/admin/users/';
const ADMIN_REVIEWS = '/api/admin/avatar-reviews/';
const MAX_UPLOAD = 4 * 1024 * 1024;
const MAX_NOTE = 500;
const USERNAME = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const HASH = /^[a-f0-9]{64}$/;
const MIN_SIDE = 280;
const MAX_SIDE = 4096;
const MAX_PIXELS = 12_000_000;
const HOUR = 3_600_000;
const MAX_ATTEMPTS = 6;

const PointerSchema = z.object({
  version: z.literal(1),
  key: z.string().nullable(),
  sha256: z.string().nullable(),
  contentType: z.literal('image/webp').nullable(),
  size: z.number(),
  updatedAt: z.string(),
});
type Pointer = z.infer<typeof PointerSchema>;

function bodyStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new Blob([bytes.slice().buffer]).stream();
}

function pointerKey(username: string): string {
  return `avatars/${username}/current.json`;
}

function imageKey(username: string, hash: string): string {
  return `avatars/${username}/${hash}.webp`;
}

function imageUrl(request: Request, username: string, hash: string): string {
  return `${new URL(request.url).origin}${ROOT}${username}/${hash}.webp`;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', bytes.slice().buffer)
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function formatFromMagic(
  bytes: Uint8Array
): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'image/jpeg';
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return 'image/png';
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  )
    return 'image/webp';
  return null;
}

export function animated(bytes: Uint8Array, format: string): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (format === 'image/png') {
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const length = view.getUint32(offset);
      if (length > bytes.length - offset - 12) return true;
      if (
        String.fromCharCode(...bytes.slice(offset + 4, offset + 8)) === 'acTL'
      )
        return true;
      offset += 12 + length;
    }
  }
  if (format === 'image/webp') {
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const length = view.getUint32(offset + 4, true);
      if (length > bytes.length - offset - 8) return true;
      const chunk = String.fromCharCode(...bytes.slice(offset, offset + 4));
      if (
        chunk === 'ANIM' ||
        (chunk === 'VP8X' && length >= 1 && Boolean(bytes[offset + 8] & 0x02))
      )
        return true;
      offset += 8 + length + (length % 2);
    }
  }
  return false;
}

async function readPointer(
  bucket: BinaryObjectStore,
  username: string
): Promise<{ value: Pointer | null; etag: string | null }> {
  const object = await bucket.get(pointerKey(username));
  if (!object) return { value: null, etag: null };
  const parsed = PointerSchema.safeParse(
    await new Response(object.body).json()
  );
  if (!parsed.success) throw new Error('Invalid avatar pointer');
  return { value: parsed.data, etag: object.etag };
}

async function owner(
  req: Request,
  env: Env
): Promise<{ username: string; email: string } | Response> {
  const origin = getRequestOrigin(req);
  const session = await verifyIdentitySession(req, env, 'people');
  if (session instanceof Response) return session;
  const email = session.email.toLowerCase();
  const username = email.split('@')[0];
  if (!username || !USERNAME.test(username))
    return createJsonErrorResponse('Invalid public identity', 403, origin);
  const permission = await getUserPermission(email, env);
  if (
    !permission ||
    permission.blacklisted ||
    !['STUDENT', 'ACADEMIC', 'ACADEMIC_SUPPORT', 'NON_ACADEMIC'].includes(
      getPermissionRole(permission)
    )
  )
    return createJsonErrorResponse(
      'Public profile access required',
      403,
      origin
    );
  const profile = await fetch(
    new URL(`/people/v2/users/${username}.json`, env.DATA_PUBLIC_BASE_URL)
  );
  if (!profile.ok)
    return createJsonErrorResponse(
      'Published public profile required',
      profile.status === 404 ? 403 : 502,
      origin
    );
  const record: unknown = await profile.json();
  if (
    !record ||
    typeof record !== 'object' ||
    !('email' in record) ||
    typeof record.email !== 'string' ||
    record.email.toLowerCase() !== email
  )
    return createJsonErrorResponse(
      'Public profile ownership mismatch',
      403,
      origin
    );
  return { username, email };
}

function usernameForEmail(email: string): string | null {
  const username = email.toLowerCase().split('@')[0] ?? '';
  return USERNAME.test(username) ? username : null;
}

async function requireSuperAdmin(
  req: Request,
  env: Env
): Promise<{ email: string } | Response> {
  const origin = getRequestOrigin(req);
  const verified = await verifySessionRequest(req, env);
  if (!verified.ok) return verified;
  const { email }: { email: string } = await verified.json();
  if (!email) return createTextErrorResponse('Unauthorized', 401, origin);
  const permission = await getUserPermission(email, env);
  if (!permission || permission.blacklisted || !isSuperAdmin(permission))
    return createTextErrorResponse('Forbidden', 403, origin);
  return { email: email.toLowerCase() };
}

function targetEmail(req: Request, suffix: string): string | null {
  const pathname = new URL(req.url).pathname;
  if (!pathname.startsWith(ADMIN_USERS)) return null;
  const segment = pathname.slice(ADMIN_USERS.length);
  if (!segment.endsWith(suffix)) return null;
  try {
    const email = decodeURIComponent(segment.slice(0, -suffix.length));
    return email && email.includes('@') ? email.toLowerCase() : null;
  } catch {
    return null;
  }
}

function reviewPayload(review: PublicAvatarReviewRecord) {
  return {
    id: review.id,
    username: review.username,
    sha256: review.sha256,
    size: review.size,
    status: review.status,
    submittedAt: new Date(review.submittedAt).toISOString(),
    reviewedAt: review.reviewedAt
      ? new Date(review.reviewedAt).toISOString()
      : null,
    reviewedBy: review.reviewedBy,
    note: review.note,
    moderation: review.moderation,
  };
}

function pendingPayload(review: PublicAvatarReviewRecord) {
  return {
    id: review.id,
    sha256: review.sha256,
    size: review.size,
    submittedAt: new Date(review.submittedAt).toISOString(),
    moderation: review.moderation,
  };
}

async function recordOwnerAudit(
  env: Env,
  input: {
    email: string;
    username: string;
    action: Extract<
      PublicAvatarAuditAction,
      'upload' | 'delete' | 'review_submitted'
    >;
    previousSha256: string | null;
    sha256: string | null;
    reviewId?: string | null;
    note?: string | null;
  }
): Promise<void> {
  await recordAvatarAudit(env, {
    username: input.username,
    actorEmail: input.email,
    actorKind: 'owner',
    action: input.action,
    previousSha256: input.previousSha256,
    sha256: input.sha256,
    reviewId: input.reviewId ?? null,
    note: input.note ?? null,
  });
}

async function cancelPendingForUser(
  env: Env,
  input: {
    username: string;
    actorEmail: string;
    actorKind: PublicAvatarAuditActorKind;
    note: string;
    submittedBefore: number;
  }
): Promise<number> {
  const reviewedAt = Date.now();
  const cancelled = await cancelPendingAvatarReviews(env, {
    username: input.username,
    reviewedBy: input.actorEmail,
    reviewedAt,
    note: input.note,
    submittedBefore: input.submittedBefore,
  });
  for (const review of cancelled) {
    await recordAvatarAudit(env, {
      username: input.username,
      actorEmail: input.actorEmail,
      actorKind: input.actorKind,
      action: PUBLIC_AVATAR_AUDIT_ACTION.REVIEW_REJECTED,
      previousSha256: null,
      sha256: review.sha256,
      reviewId: review.id,
      note: input.note,
      createdAt: reviewedAt,
    });
    await deleteReviewObject(env, review);
  }
  return cancelled.length;
}

async function deleteReviewObject(
  env: Env,
  review: PublicAvatarReviewRecord
): Promise<void> {
  try {
    const current = await readPointer(avatarStore(env), review.username);
    if (current.value?.sha256 === review.sha256) return;
    if (await hasPendingAvatarObject(env, review.username, review.sha256))
      return;
    await avatarStore(env).delete(review.objectKey);
  } catch (error) {
    // The review row is authoritative. A failed cleanup must not turn an
    // already-recorded decision into an error response; the private object
    // simply remains unreferenced in R2.
    console.error('Failed to delete public avatar review object:', error);
  }
}

const HOUR_MS = HOUR;

function currentWindowStart(now: number): number {
  return Math.floor(now / HOUR_MS) * HOUR_MS;
}

export function avatarQuota(
  attempts: number,
  now = Date.now()
): PublicAvatarQuota {
  const windowStartedAt = currentWindowStart(now);
  const resetsAt = windowStartedAt + HOUR_MS;
  const normalizedAttempts = Number.isFinite(attempts)
    ? Math.max(0, Math.trunc(attempts))
    : 0;
  const used = Math.min(normalizedAttempts, MAX_ATTEMPTS);
  return {
    limit: MAX_ATTEMPTS,
    used,
    remaining: MAX_ATTEMPTS - used,
    windowStartedAt: new Date(windowStartedAt).toISOString(),
    resetsAt: new Date(resetsAt).toISOString(),
    retryAfterSeconds: Math.max(0, Math.ceil((resetsAt - now) / 1000)),
    available: used < MAX_ATTEMPTS,
  };
}

async function readAvatarQuota(
  env: Env,
  username: string,
  now = Date.now()
): Promise<PublicAvatarQuota> {
  const windowStartedAt = currentWindowStart(now);
  const row = await env.AUTH_DB.prepare(
    `SELECT window_start AS windowStart, attempts FROM public_avatar_rate WHERE user_id = ?`
  )
    .bind(username)
    .first<{ windowStart: number; attempts: number }>();
  const attempts =
    row && row.windowStart === windowStartedAt ? row.attempts : 0;
  return avatarQuota(attempts, now);
}

async function consumeAttempt(
  env: Env,
  username: string,
  now = Date.now()
): Promise<PublicAvatarQuota | null> {
  const windowStartedAt = currentWindowStart(now);
  const result = await env.AUTH_DB.prepare(
    `INSERT INTO public_avatar_rate (user_id, window_start, attempts) VALUES (?, ?, 1) ON CONFLICT(user_id) DO UPDATE SET window_start = excluded.window_start, attempts = CASE WHEN window_start = excluded.window_start THEN attempts + 1 ELSE 1 END RETURNING attempts`
  )
    .bind(username, windowStartedAt)
    .first<{ attempts: number }>();
  return result ? avatarQuota(result.attempts, now) : null;
}

interface AvatarErrorOptions {
  code?: string;
  moderation?: PublicAvatarModeration;
  quota?: PublicAvatarQuota;
}

function avatarError(
  message: string,
  status: number,
  origin: string,
  options: AvatarErrorOptions = {}
): Response {
  const headers = createCorsHeaders(origin);
  if (status === 429 && options.quota) {
    headers['Retry-After'] = String(
      Math.max(1, options.quota.retryAfterSeconds)
    );
    headers['Access-Control-Expose-Headers'] = 'Retry-After';
  }
  return Response.json(
    {
      error: message,
      ...(options.code ? { code: options.code } : {}),
      ...(options.quota ? { quota: options.quota } : {}),
      ...(options.moderation ? { moderation: options.moderation } : {}),
    },
    { status, headers }
  );
}

async function boundedMultipart(req: Request): Promise<FormData | null> {
  if (!req.body) return null;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_UPLOAD + 16_384) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Request(req.url, {
    method: 'POST',
    headers: req.headers,
    body: bytes,
  }).formData();
}

export async function uploadMyAvatar(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  // Pending reviews submitted after this point may belong to a newer upload
  // that is still in flight, so only older reviews are superseded below.
  const startedAt = Date.now();
  const identity = await owner(req, env);
  if (identity instanceof Response) return identity;
  const quota = await consumeAttempt(env, identity.username);
  if (!quota || !quota.available)
    return avatarError('Avatar upload limit reached', 429, origin, {
      code: 'avatar_rate_limited',
      ...(quota ? { quota } : {}),
    });
  // Snapshot the pointer before processing so a slower earlier upload cannot
  // overwrite a newer successful request after moderation.
  const before = await readPointer(avatarStore(env), identity.username);
  const contentLength = Number(req.headers.get('content-length'));
  if (contentLength > MAX_UPLOAD + 16_384)
    return avatarError('Image exceeds 4 MiB', 413, origin, { quota });
  if (!req.headers.get('content-type')?.startsWith('multipart/form-data'))
    return avatarError('Multipart image required', 415, origin, { quota });
  let form: FormData;
  try {
    const parsed = await boundedMultipart(req);
    if (!parsed)
      return avatarError('Image exceeds 4 MiB', 413, origin, { quota });
    form = parsed;
  } catch {
    return avatarError('Invalid multipart upload', 400, origin, { quota });
  }
  const file = form.get('image');
  if (
    !(file instanceof File) ||
    form.getAll('image').length !== 1 ||
    [...form.keys()].some((key) => key !== 'image')
  )
    return avatarError('One image is required', 400, origin, { quota });
  if (file.size === 0 || file.size > MAX_UPLOAD)
    return avatarError('Image exceeds 4 MiB or is empty', 413, origin, {
      quota,
    });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = formatFromMagic(bytes);
  if (!format || file.type !== format || animated(bytes, format))
    return avatarError('Unsupported, animated, or spoofed image', 415, origin, {
      quota,
    });
  let webp: Uint8Array;
  let jpeg: Uint8Array;
  try {
    const info = await env.IMAGES.info(bodyStream(bytes));
    if (
      !('width' in info) ||
      info.format !== format ||
      info.width < MIN_SIDE ||
      info.height < MIN_SIDE ||
      info.width > MAX_SIDE ||
      info.height > MAX_SIDE ||
      info.width * info.height > MAX_PIXELS
    )
      return avatarError('Invalid image dimensions', 422, origin, { quota });
    const transform = { width: 512, height: 512, fit: 'cover' as const };
    const webpResponse = (
      await env.IMAGES.input(bodyStream(bytes))
        .transform(transform)
        .output({ format: 'image/webp', anim: false })
    ).response();
    const jpegResponse = (
      await env.IMAGES.input(bodyStream(bytes))
        .transform(transform)
        .output({ format: 'image/jpeg', anim: false })
    ).response();
    webp = new Uint8Array(await webpResponse.arrayBuffer());
    jpeg = new Uint8Array(await jpegResponse.arrayBuffer());
    if (!webp.length || !jpeg.length)
      throw new Error('Empty transformed image');
  } catch {
    return avatarError('Image could not be decoded', 422, origin, { quota });
  }
  const decision = await createAvatarModerator({
    provider: createTypeSafeProvider({ apiKey: env.TYPESAFE_API_KEY }),
  }).moderate(jpeg);
  const hash = await sha256Hex(webp);
  const key = imageKey(identity.username, hash);
  if (decision.status !== 'approved') {
    if (decision.status === 'review_required') {
      await avatarStore(env).put(key, webp, {
        metadata: { contentType: 'image/webp' },
        sha256: hash,
      });
      const reviewId = crypto.randomUUID();
      const submittedAt = Date.now();
      await createAvatarReview(env, {
        id: reviewId,
        username: identity.username,
        sha256: hash,
        objectKey: key,
        size: webp.length,
        moderation: decision,
        submittedAt,
      });
      await recordOwnerAudit(env, {
        email: identity.email,
        username: identity.username,
        action: PUBLIC_AVATAR_AUDIT_ACTION.REVIEW_SUBMITTED,
        previousSha256: before.value?.sha256 ?? null,
        sha256: hash,
        reviewId,
        note: decision.message,
      });
      // Keep at most one pending candidate per member. The review row exists
      // first so its shared content-addressed object is never deleted as part
      // of cancelling an older review with the same bytes.
      await cancelPendingForUser(env, {
        username: identity.username,
        actorEmail: identity.email,
        actorKind: 'owner',
        note: 'Superseded by a newer picture awaiting review.',
        submittedBefore: submittedAt,
      });
      return avatarError(
        'Image needs manual review. An administrator can approve it.',
        503,
        origin,
        {
          code: 'avatar_moderation_review_required',
          moderation: decision,
          quota,
        }
      );
    }
    return avatarError(
      decision.message,
      decision.status === 'rejected' ? 422 : 503,
      origin,
      {
        code:
          decision.status === 'rejected'
            ? 'avatar_moderation_rejected'
            : 'avatar_moderation_unavailable',
        moderation: decision,
        quota,
      }
    );
  }
  await avatarStore(env).put(key, webp, {
    metadata: { contentType: 'image/webp' },
    sha256: hash,
  });
  const pointer: Pointer = {
    version: 1,
    key,
    sha256: hash,
    contentType: 'image/webp',
    size: webp.length,
    updatedAt: new Date().toISOString(),
  };
  const stored = await avatarStore(env).put(
    pointerKey(identity.username),
    JSON.stringify(pointer),
    {
      condition: before.etag
        ? { kind: 'match', etag: before.etag }
        : { kind: 'create' },
      metadata: { contentType: 'application/json' },
    }
  );
  if (!stored)
    return avatarError('Avatar changed concurrently; retry', 409, origin, {
      quota,
    });
  await cancelPendingForUser(env, {
    username: identity.username,
    actorEmail: identity.email,
    actorKind: 'owner',
    note: 'Superseded by a newer approved picture.',
    submittedBefore: startedAt,
  });
  await recordOwnerAudit(env, {
    email: identity.email,
    username: identity.username,
    action: PUBLIC_AVATAR_AUDIT_ACTION.UPLOAD,
    previousSha256: before.value?.sha256 ?? null,
    sha256: hash,
  });
  return createJsonResponse(
    {
      url: imageUrl(req, identity.username, hash),
      sha256: hash,
      size: webp.length,
      updatedAt: pointer.updatedAt,
      moderation: decision,
      quota,
    },
    200,
    origin
  );
}

async function tombstoneAvatar(
  env: Env,
  username: string
): Promise<
  | { deleted: false; previousSha256: string | null; conflict: false }
  | { deleted: true; previousSha256: string | null; conflict: false }
  | { deleted: false; previousSha256: string | null; conflict: true }
> {
  const before = await readPointer(avatarStore(env), username);
  if (!before.value?.key)
    return {
      deleted: false,
      previousSha256: before.value?.sha256 ?? null,
      conflict: false,
    };
  if (!before.etag) throw new Error('Invalid avatar pointer etag');
  const tombstone: Pointer = {
    version: 1,
    key: null,
    sha256: null,
    contentType: null,
    size: 0,
    updatedAt: new Date().toISOString(),
  };
  const stored = await avatarStore(env).put(
    pointerKey(username),
    JSON.stringify(tombstone),
    {
      condition: { kind: 'match', etag: before.etag },
      metadata: { contentType: 'application/json' },
    }
  );
  return stored
    ? { deleted: true, previousSha256: before.value.sha256, conflict: false }
    : { deleted: false, previousSha256: before.value.sha256, conflict: true };
}

export async function deleteMyAvatar(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const startedAt = Date.now();
  const identity = await owner(req, env);
  if (identity instanceof Response) return identity;
  const quota = await readAvatarQuota(env, identity.username).catch(
    () => undefined
  );
  const pending = await listPendingAvatarReviewsForUser(
    env,
    identity.username,
    {
      submittedBefore: startedAt,
    }
  );
  const result = await tombstoneAvatar(env, identity.username);
  if (result.conflict)
    return avatarError('Avatar changed concurrently; retry', 409, origin, {
      ...(quota ? { quota } : {}),
    });
  await cancelPendingForUser(env, {
    username: identity.username,
    actorEmail: identity.email,
    actorKind: 'owner',
    note: 'Removed by the profile owner.',
    submittedBefore: startedAt,
  });
  if (!result.deleted && pending.length === 0)
    return createJsonResponse(
      { deleted: false, ...(quota ? { quota } : {}) },
      200,
      origin
    );
  if (result.deleted) {
    await recordOwnerAudit(env, {
      email: identity.email,
      username: identity.username,
      action: PUBLIC_AVATAR_AUDIT_ACTION.DELETE,
      previousSha256: result.previousSha256,
      sha256: null,
    });
  }
  return createJsonResponse(
    { deleted: true, ...(quota ? { quota } : {}) },
    200,
    origin
  );
}

export async function getMyAvatar(req: Request, env: Env): Promise<Response> {
  const origin = getRequestOrigin(req);
  const identity = await owner(req, env);
  if (identity instanceof Response) return identity;
  const [current, pending, quota] = await Promise.all([
    readPointer(avatarStore(env), identity.username),
    getPendingAvatarReviewForUser(env, identity.username),
    readAvatarQuota(env, identity.username).catch(() => undefined),
  ]);
  return createJsonResponse(
    {
      username: identity.username,
      url: current.value?.sha256
        ? imageUrl(req, identity.username, current.value.sha256)
        : null,
      pending: pending ? pendingPayload(pending) : null,
      ...(quota ? { quota } : {}),
    },
    200,
    origin
  );
}

export async function getMyPendingAvatarReviewImage(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const identity = await owner(req, env);
  if (identity instanceof Response) return identity;
  const id = new URL(req.url).searchParams.get('id')?.trim() || undefined;
  const review = await getPendingAvatarReviewForUser(
    env,
    identity.username,
    id
  );
  if (!review)
    return createJsonErrorResponse('Review picture not found', 404, origin);
  const object = await avatarStore(env).get(review.objectKey);
  if (!object)
    return createJsonErrorResponse('Review picture not found', 404, origin);
  const headers = new Headers(createCorsHeaders(origin));
  headers.set('Content-Type', 'image/webp');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cache-Control', 'no-store');
  return new Response(object.body, { status: 200, headers });
}

export async function deleteMyPendingAvatarReview(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const startedAt = Date.now();
  const identity = await owner(req, env);
  if (identity instanceof Response) return identity;
  const cancelled = await cancelPendingForUser(env, {
    username: identity.username,
    actorEmail: identity.email,
    actorKind: 'owner',
    note: 'Withdrawn by the profile owner.',
    submittedBefore: startedAt,
  });
  return createJsonResponse({ deleted: cancelled > 0 }, 200, origin);
}

export async function getPublicAvatar(
  req: Request,
  env: Env
): Promise<Response> {
  const path = new URL(req.url).pathname.slice(ROOT.length).split('/');
  if (
    (req.method !== 'GET' && req.method !== 'HEAD') ||
    (path.length !== 1 && path.length !== 2)
  )
    return new Response(null, { status: 404 });
  const [username, filename] = path;
  if (!username || !USERNAME.test(username))
    return new Response(null, { status: 404 });
  const current = await readPointer(avatarStore(env), username);
  if (!current.value?.key || !current.value.sha256)
    return new Response(null, {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  if (!filename)
    return new Response(null, {
      status: 302,
      headers: {
        Location: imageUrl(req, username, current.value.sha256),
        'Cache-Control': 'no-store',
      },
    });
  const hash = filename.endsWith('.webp') ? filename.slice(0, -5) : '';
  if (
    !HASH.test(hash) ||
    current.value.sha256 !== hash ||
    current.value.key !== imageKey(username, hash)
  )
    return new Response(null, {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  const object =
    req.method === 'HEAD'
      ? await avatarStore(env).head(current.value.key)
      : await avatarStore(env).get(current.value.key);
  if (!object)
    return new Response(null, {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  const headers = new Headers({
    'Content-Type': 'image/webp',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    ETag: `"${object.etag}"`,
  });
  if (req.headers.get('if-none-match') === `"${object.etag}"`)
    return new Response(null, { status: 304, headers });
  const body =
    req.method === 'HEAD'
      ? null
      : 'body' in object
        ? (object.body as ReadableStream<Uint8Array>)
        : null;
  return new Response(body, { status: 200, headers });
}

async function optionalNote(
  req: Request
): Promise<{ ok: true; note: string | null } | { ok: false }> {
  const text = await req.text();
  if (!text.trim()) return { ok: true, note: null };
  try {
    const body: unknown = JSON.parse(text);
    if (!isRecord(body)) return { ok: false };
    const note = body.note;
    if (note === undefined || note === null) return { ok: true, note: null };
    if (typeof note !== 'string' || note.trim().length > MAX_NOTE)
      return { ok: false };
    return { ok: true, note: note.trim() || null };
  } catch {
    return { ok: false };
  }
}

export async function getAdminUserAvatar(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const admin = await requireSuperAdmin(req, env);
  if (admin instanceof Response) return admin;
  const email = targetEmail(req, '/avatar');
  if (!email) return createJsonErrorResponse('Email required', 400, origin);
  const username = usernameForEmail(email);
  if (!username)
    return createJsonErrorResponse('Invalid avatar username', 400, origin);
  const [current, pending, history, quota] = await Promise.all([
    readPointer(avatarStore(env), username),
    listPendingAvatarReviewsForUser(env, username),
    listAvatarAudit(env, username),
    readAvatarQuota(env, username).catch(() => undefined),
  ]);
  return createJsonResponse(
    {
      email,
      username,
      url: current.value?.sha256
        ? imageUrl(req, username, current.value.sha256)
        : null,
      pending: pending.map(reviewPayload),
      ...(quota ? { quota } : {}),
      history: history.map((entry) => ({
        id: entry.id,
        username: entry.username,
        actorEmail: entry.actorEmail,
        actorKind: entry.actorKind,
        action: entry.action,
        previousSha256: entry.previousSha256,
        sha256: entry.sha256,
        reviewId: entry.reviewId,
        note: entry.note,
        createdAt: new Date(entry.createdAt).toISOString(),
      })),
    },
    200,
    origin
  );
}

export async function deleteAdminUserAvatar(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const admin = await requireSuperAdmin(req, env);
  if (admin instanceof Response) return admin;
  const email = targetEmail(req, '/avatar');
  if (!email) return createJsonErrorResponse('Email required', 400, origin);
  const username = usernameForEmail(email);
  if (!username)
    return createJsonErrorResponse('Invalid avatar username', 400, origin);
  const parsed = await optionalNote(req);
  if (!parsed.ok) return createJsonErrorResponse('Invalid note', 400, origin);
  const startedAt = Date.now();
  const pending = await listPendingAvatarReviewsForUser(env, username, {
    submittedBefore: startedAt,
  });
  const result = await tombstoneAvatar(env, username);
  if (result.conflict)
    return createJsonErrorResponse(
      'Avatar changed concurrently; retry',
      409,
      origin
    );
  await cancelPendingForUser(env, {
    username,
    actorEmail: admin.email,
    actorKind: 'admin',
    note: 'Removed by an administrator.',
    submittedBefore: startedAt,
  });
  if (!result.deleted && pending.length === 0)
    return createJsonResponse({ deleted: false }, 200, origin);
  if (result.deleted) {
    await recordAvatarAudit(env, {
      username,
      actorEmail: admin.email,
      actorKind: 'admin',
      action: PUBLIC_AVATAR_AUDIT_ACTION.ADMIN_DELETE,
      previousSha256: result.previousSha256,
      sha256: null,
      reviewId: null,
      note: parsed.note,
    });
  }
  return createJsonResponse({ deleted: true }, 200, origin);
}

export async function resetAdminUserAvatarQuota(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const admin = await requireSuperAdmin(req, env);
  if (admin instanceof Response) return admin;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createJsonErrorResponse('Invalid JSON body', 400, origin);
  }
  if (!isRecord(body))
    return createJsonErrorResponse(
      'Request body must be a JSON object',
      400,
      origin
    );
  const username = body.username;
  if (typeof username !== 'string')
    return createJsonErrorResponse('Invalid avatar username', 400, origin);
  const normalizedUsername = username.trim().toLowerCase();
  if (!USERNAME.test(normalizedUsername))
    return createJsonErrorResponse('Invalid avatar username', 400, origin);
  await env.AUTH_DB.prepare('DELETE FROM public_avatar_rate WHERE user_id = ?')
    .bind(normalizedUsername)
    .run();
  return createJsonResponse({ quota: avatarQuota(0) }, 200, origin);
}

export async function listAdminAvatarReviews(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const admin = await requireSuperAdmin(req, env);
  if (admin instanceof Response) return admin;
  try {
    const request = parsePaginationRequest(new URL(req.url));
    const value = request.cursor
      ? decodePaginationCursor('admin-avatar-reviews', request.cursor)
      : null;
    let cursor: PublicAvatarReviewCursor | undefined;
    if (value) {
      const [submittedAt, id] = value.split('|');
      const parsedAt = Number(submittedAt);
      if (!Number.isFinite(parsedAt) || !id)
        throw new InvalidPaginationCursorError();
      cursor = { submittedAt: parsedAt, id };
    }
    const result = await listPendingAvatarReviewPage(env, {
      cursor,
      limit: request.limit,
    });
    const nextCursor = result.nextCursor
      ? encodePaginationCursor(
          'admin-avatar-reviews',
          `${result.nextCursor.submittedAt}|${result.nextCursor.id}`
        )
      : null;
    return createJsonResponse(
      {
        version: 1,
        items: result.items.map(reviewPayload),
        page: { nextCursor, hasMore: nextCursor !== null },
      },
      200,
      origin
    );
  } catch (error) {
    if (error instanceof InvalidPaginationCursorError)
      return createJsonErrorResponse(
        'Invalid cursor or page limit',
        400,
        origin
      );
    console.error('Error fetching avatar reviews:', error);
    return createTextErrorResponse('Internal Server Error', 500, origin);
  }
}

export async function getAdminAvatarReviewImage(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const admin = await requireSuperAdmin(req, env);
  if (admin instanceof Response) return admin;
  const pathname = new URL(req.url).pathname;
  const parts = pathname.slice(ADMIN_REVIEWS.length).split('/');
  if (parts.length !== 2 || parts[1] !== 'image')
    return createJsonErrorResponse('Not Found', 404, origin);
  let id: string;
  try {
    id = decodeURIComponent(parts[0]);
  } catch {
    return createJsonErrorResponse('Not Found', 404, origin);
  }
  const review = await getAvatarReview(env, id);
  if (!review) return createJsonErrorResponse('Review not found', 404, origin);
  const object = await avatarStore(env).get(review.objectKey);
  if (!object)
    return createJsonErrorResponse('Review image not found', 404, origin);
  const headers = new Headers(createCorsHeaders(origin));
  headers.set('Content-Type', 'image/webp');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cache-Control', 'no-store');
  return new Response(object.body, { status: 200, headers });
}

export async function decideAdminAvatarReview(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const admin = await requireSuperAdmin(req, env);
  if (admin instanceof Response) return admin;
  const pathname = new URL(req.url).pathname;
  const rawId = pathname.slice(ADMIN_REVIEWS.length);
  if (!rawId || rawId.includes('/'))
    return createJsonErrorResponse('Not Found', 404, origin);
  let id: string;
  try {
    id = decodeURIComponent(rawId);
  } catch {
    return createJsonErrorResponse('Not Found', 404, origin);
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createJsonErrorResponse('Invalid JSON body', 400, origin);
  }
  if (!isRecord(body))
    return createJsonErrorResponse(
      'Request body must be a JSON object',
      400,
      origin
    );
  const record = body;
  const action = record.action;
  if (action !== 'approve' && action !== 'reject')
    return createJsonErrorResponse('Invalid review action', 400, origin);
  let note: string | null = null;
  if (record.note !== undefined && record.note !== null) {
    if (typeof record.note !== 'string' || record.note.trim().length > MAX_NOTE)
      return createJsonErrorResponse('Invalid note', 400, origin);
    note = record.note.trim() || null;
  }
  const review = await getAvatarReview(env, id);
  if (!review) return createJsonErrorResponse('Review not found', 404, origin);
  if (review.status !== 'pending')
    return createJsonErrorResponse('Review already decided', 409, origin);
  const reviewedAt = Date.now();
  if (action === 'approve') {
    // Claim the review before publishing so a concurrent rejection can never
    // leave a picture public that has no approving administrator on record.
    if (
      !(await markAvatarReview(env, {
        id,
        status: 'approved',
        reviewedBy: admin.email,
        reviewedAt,
        note,
      }))
    )
      return createJsonErrorResponse('Review already decided', 409, origin);
    let previousSha256: string | null = null;
    try {
      if (!(await avatarStore(env).head(review.objectKey)))
        throw new Error('Review image is missing');
      const before = await readPointer(avatarStore(env), review.username);
      previousSha256 = before.value?.sha256 ?? null;
      const pointer: Pointer = {
        version: 1,
        key: review.objectKey,
        sha256: review.sha256,
        contentType: 'image/webp',
        size: review.size,
        updatedAt: new Date(reviewedAt).toISOString(),
      };
      const stored = await avatarStore(env).put(
        pointerKey(review.username),
        JSON.stringify(pointer),
        {
          condition: before.etag
            ? { kind: 'match', etag: before.etag }
            : { kind: 'create' },
          metadata: { contentType: 'application/json' },
        }
      );
      if (!stored) {
        await reopenAvatarReview(env, id, reviewedAt);
        return createJsonErrorResponse(
          'Avatar changed concurrently; retry',
          409,
          origin
        );
      }
    } catch {
      // Publishing failed after the review was claimed. Return it to the queue
      // so the administrator can retry or reject it instead of publishing a
      // pointer to a missing or unwritable object.
      await reopenAvatarReview(env, id, reviewedAt);
      return createJsonErrorResponse(
        'Could not publish the reviewed picture; reject it instead',
        502,
        origin
      );
    }
    await cancelPendingForUser(env, {
      username: review.username,
      actorEmail: admin.email,
      actorKind: 'admin',
      note: 'Superseded by an approved review.',
      submittedBefore: review.submittedAt,
    });
    await recordAvatarAudit(env, {
      username: review.username,
      actorEmail: admin.email,
      actorKind: 'admin',
      action: PUBLIC_AVATAR_AUDIT_ACTION.REVIEW_APPROVED,
      previousSha256,
      sha256: review.sha256,
      reviewId: review.id,
      note,
      createdAt: reviewedAt,
    });
    return createJsonResponse(
      {
        review: reviewPayload({
          ...review,
          status: 'approved',
          reviewedAt,
          reviewedBy: admin.email,
          note,
        }),
        url: imageUrl(req, review.username, review.sha256),
      },
      200,
      origin
    );
  }
  if (
    !(await markAvatarReview(env, {
      id,
      status: 'rejected',
      reviewedBy: admin.email,
      reviewedAt,
      note,
    }))
  )
    return createJsonErrorResponse('Review already decided', 409, origin);
  await recordAvatarAudit(env, {
    username: review.username,
    actorEmail: admin.email,
    actorKind: 'admin',
    action: PUBLIC_AVATAR_AUDIT_ACTION.REVIEW_REJECTED,
    previousSha256: null,
    sha256: review.sha256,
    reviewId: review.id,
    note,
    createdAt: reviewedAt,
  });
  await deleteReviewObject(env, review);
  return createJsonResponse(
    {
      review: reviewPayload({
        ...review,
        status: 'rejected',
        reviewedAt,
        reviewedBy: admin.email,
        note,
      }),
      url: null,
    },
    200,
    origin
  );
}
