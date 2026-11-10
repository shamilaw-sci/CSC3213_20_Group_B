import type {
  PublicAvatarAuditAction,
  PublicAvatarAuditActorKind,
  PublicAvatarModeration,
  PublicAvatarReviewStatus,
} from '@scs/schemas';
import { PublicAvatarModerationSchema } from '@scs/schemas';

import type { Env } from '@/types/env';
import { requireD1 } from '@/types/env';

export const PUBLIC_AVATAR_AUDIT_ACTION = {
  UPLOAD: 'upload',
  DELETE: 'delete',
  ADMIN_DELETE: 'admin_delete',
  REVIEW_SUBMITTED: 'review_submitted',
  REVIEW_APPROVED: 'review_approved',
  REVIEW_REJECTED: 'review_rejected',
} as const;

export interface PublicAvatarReviewRecord {
  id: string;
  username: string;
  sha256: string;
  objectKey: string;
  size: number;
  moderation: PublicAvatarModeration | null;
  status: PublicAvatarReviewStatus;
  submittedAt: number;
  reviewedAt: number | null;
  reviewedBy: string | null;
  note: string | null;
}

export interface PublicAvatarAuditRecord {
  id: string;
  username: string;
  actorEmail: string;
  actorKind: PublicAvatarAuditActorKind;
  action: PublicAvatarAuditAction;
  previousSha256: string | null;
  sha256: string | null;
  reviewId: string | null;
  note: string | null;
  createdAt: number;
}

export interface PublicAvatarReviewCursor {
  submittedAt: number;
  id: string;
}

export interface PublicAvatarReviewPage {
  items: PublicAvatarReviewRecord[];
  nextCursor: PublicAvatarReviewCursor | null;
}

export interface ReviewRow {
  id: string;
  username: string;
  sha256: string;
  objectKey: string;
  size: number;
  moderationJson: string;
  status: PublicAvatarReviewStatus;
  submittedAt: number;
  reviewedAt: number | null;
  reviewedBy: string | null;
  note: string | null;
}

export interface AuditRow {
  id: string;
  username: string;
  actorEmail: string;
  actorKind: PublicAvatarAuditActorKind;
  action: PublicAvatarAuditAction;
  previousSha256: string | null;
  sha256: string | null;
  reviewId: string | null;
  note: string | null;
  createdAt: number;
}

function parseModeration(value: string): PublicAvatarModeration | null {
  try {
    const parsed = PublicAvatarModerationSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function toReview(row: ReviewRow): PublicAvatarReviewRecord {
  return {
    id: row.id,
    username: row.username,
    sha256: row.sha256,
    objectKey: row.objectKey,
    size: row.size,
    moderation: parseModeration(row.moderationJson),
    status: row.status,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    reviewedBy: row.reviewedBy,
    note: row.note,
  };
}

export function toAudit(row: AuditRow): PublicAvatarAuditRecord {
  return {
    id: row.id,
    username: row.username,
    actorEmail: row.actorEmail,
    actorKind: row.actorKind,
    action: row.action,
    previousSha256: row.previousSha256,
    sha256: row.sha256,
    reviewId: row.reviewId,
    note: row.note,
    createdAt: row.createdAt,
  };
}

const REVIEW_COLUMNS = `id, username, sha256, object_key AS objectKey,
  size, moderation_json AS moderationJson, status, submitted_at AS submittedAt,
  reviewed_at AS reviewedAt, reviewed_by AS reviewedBy, review_note AS note`;

const AUDIT_COLUMNS = `id, username, actor_email AS actorEmail,
  actor_kind AS actorKind, action, previous_sha256 AS previousSha256,
  sha256, review_id AS reviewId, note, created_at AS createdAt`;

export async function createAvatarReview(
  env: Env,
  input: {
    id: string;
    username: string;
    sha256: string;
    objectKey: string;
    size: number;
    moderation: PublicAvatarModeration;
    submittedAt: number;
  }
): Promise<void> {
  if (env.AVATAR_REVIEW_REPOSITORY)
    return env.AVATAR_REVIEW_REPOSITORY.create(input);
  await requireD1(env)
    .prepare(
      `INSERT INTO public_avatar_review (
      id, username, sha256, object_key, size, moderation_json, status, submitted_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
    )
    .bind(
      input.id,
      input.username,
      input.sha256,
      input.objectKey,
      input.size,
      JSON.stringify(input.moderation),
      input.submittedAt
    )
    .run();
}

export async function getAvatarReview(
  env: Env,
  id: string
): Promise<PublicAvatarReviewRecord | null> {
  if (env.AVATAR_REVIEW_REPOSITORY) return env.AVATAR_REVIEW_REPOSITORY.get(id);
  const row = await requireD1(env)
    .prepare(
      `SELECT ${REVIEW_COLUMNS} FROM public_avatar_review WHERE id = ? LIMIT 1`
    )
    .bind(id)
    .first<ReviewRow>();
  return row ? toReview(row) : null;
}

export async function markAvatarReview(
  env: Env,
  input: {
    id: string;
    status: 'approved' | 'rejected';
    reviewedBy: string;
    reviewedAt: number;
    note?: string | null;
  }
): Promise<boolean> {
  if (env.AVATAR_REVIEW_REPOSITORY)
    return env.AVATAR_REVIEW_REPOSITORY.mark(input);
  const result = await requireD1(env)
    .prepare(
      `UPDATE public_avatar_review
     SET status = ?, reviewed_at = ?, reviewed_by = ?, review_note = ?
     WHERE id = ? AND status = 'pending'`
    )
    .bind(
      input.status,
      input.reviewedAt,
      input.reviewedBy,
      input.note ?? null,
      input.id
    )
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function reopenAvatarReview(
  env: Env,
  id: string,
  reviewedAt: number
): Promise<void> {
  if (env.AVATAR_REVIEW_REPOSITORY)
    return env.AVATAR_REVIEW_REPOSITORY.reopen(id, reviewedAt);
  // Only undo the decision made by the caller whose reviewed_at matches, so a
  // concurrent decision is never reopened by a failed publish attempt.
  await requireD1(env)
    .prepare(
      `UPDATE public_avatar_review
     SET status = 'pending', reviewed_at = NULL, reviewed_by = NULL, review_note = NULL
     WHERE id = ? AND status = 'approved' AND reviewed_at = ?`
    )
    .bind(id, reviewedAt)
    .run();
}

export async function getPendingAvatarReviewForUser(
  env: Env,
  username: string,
  id?: string
): Promise<PublicAvatarReviewRecord | null> {
  if (env.AVATAR_REVIEW_REPOSITORY)
    return env.AVATAR_REVIEW_REPOSITORY.getPendingForUser(username, id);
  const row = id
    ? await requireD1(env)
        .prepare(
          `SELECT ${REVIEW_COLUMNS} FROM public_avatar_review
         WHERE username = ? AND id = ? AND status = 'pending'
         LIMIT 1`
        )
        .bind(username, id)
        .first<ReviewRow>()
    : await requireD1(env)
        .prepare(
          `SELECT ${REVIEW_COLUMNS} FROM public_avatar_review
         WHERE username = ? AND status = 'pending'
         ORDER BY submitted_at DESC, id DESC
         LIMIT 1`
        )
        .bind(username)
        .first<ReviewRow>();
  return row ? toReview(row) : null;
}

export async function listPendingAvatarReviewsForUser(
  env: Env,
  username: string,
  options: { limit?: number; submittedBefore?: number } = {}
): Promise<PublicAvatarReviewRecord[]> {
  if (env.AVATAR_REVIEW_REPOSITORY)
    return env.AVATAR_REVIEW_REPOSITORY.listPendingForUser(username, options);
  const limit = options.limit ?? 50;
  const rows =
    options.submittedBefore === undefined
      ? await requireD1(env)
          .prepare(
            `SELECT ${REVIEW_COLUMNS} FROM public_avatar_review
           WHERE username = ? AND status = 'pending'
           ORDER BY submitted_at DESC, id DESC
           LIMIT ?`
          )
          .bind(username, limit)
          .all<ReviewRow>()
      : await requireD1(env)
          .prepare(
            `SELECT ${REVIEW_COLUMNS} FROM public_avatar_review
           WHERE username = ? AND status = 'pending' AND submitted_at <= ?
           ORDER BY submitted_at DESC, id DESC
           LIMIT ?`
          )
          .bind(username, options.submittedBefore, limit)
          .all<ReviewRow>();
  return rows.results.map(toReview);
}

export async function listPendingAvatarReviewPage(
  env: Env,
  input: { cursor?: PublicAvatarReviewCursor; limit: number }
): Promise<PublicAvatarReviewPage> {
  if (env.AVATAR_REVIEW_REPOSITORY)
    return env.AVATAR_REVIEW_REPOSITORY.listPendingPage(input);
  const rows = input.cursor
    ? await requireD1(env)
        .prepare(
          `SELECT ${REVIEW_COLUMNS} FROM public_avatar_review
         WHERE status = 'pending'
           AND (submitted_at < ? OR (submitted_at = ? AND id < ?))
         ORDER BY submitted_at DESC, id DESC
         LIMIT ?`
        )
        .bind(
          input.cursor.submittedAt,
          input.cursor.submittedAt,
          input.cursor.id,
          input.limit + 1
        )
        .all<ReviewRow>()
    : await requireD1(env)
        .prepare(
          `SELECT ${REVIEW_COLUMNS} FROM public_avatar_review
         WHERE status = 'pending'
         ORDER BY submitted_at DESC, id DESC
         LIMIT ?`
        )
        .bind(input.limit + 1)
        .all<ReviewRow>();

  const hasMore = rows.results.length > input.limit;
  const pageRows = rows.results.slice(0, input.limit);
  const last = pageRows.at(-1);
  return {
    items: pageRows.map(toReview),
    nextCursor:
      hasMore && last ? { submittedAt: last.submittedAt, id: last.id } : null,
  };
}

export async function cancelPendingAvatarReviews(
  env: Env,
  input: {
    username: string;
    reviewedBy: string;
    reviewedAt: number;
    note: string;
    submittedBefore: number;
  }
): Promise<PublicAvatarReviewRecord[]> {
  if (env.AVATAR_REVIEW_REPOSITORY)
    return env.AVATAR_REVIEW_REPOSITORY.cancelPending(input);
  // One statement both cancels and returns exactly the rows this call
  // transitioned. This avoids a page-sized limit leaving stale pending rows and
  // never re-audits a decision that raced ahead of us.
  const rows = await requireD1(env)
    .prepare(
      `UPDATE public_avatar_review
     SET status = 'rejected', reviewed_at = ?, reviewed_by = ?, review_note = ?
     WHERE username = ? AND status = 'pending' AND submitted_at < ?
     RETURNING ${REVIEW_COLUMNS}`
    )
    .bind(
      input.reviewedAt,
      input.reviewedBy,
      input.note,
      input.username,
      input.submittedBefore
    )
    .all<ReviewRow>();
  return rows.results.map(toReview);
}

export async function hasPendingAvatarObject(
  env: Env,
  username: string,
  sha256: string
): Promise<boolean> {
  if (env.AVATAR_REVIEW_REPOSITORY)
    return env.AVATAR_REVIEW_REPOSITORY.hasPendingObject(username, sha256);
  const row = await requireD1(env)
    .prepare(
      `SELECT 1 AS present FROM public_avatar_review
     WHERE username = ? AND sha256 = ? AND status = 'pending'
     LIMIT 1`
    )
    .bind(username, sha256)
    .first<{ present: number }>();
  return row !== null;
}

export async function recordAvatarAudit(
  env: Env,
  input: Omit<PublicAvatarAuditRecord, 'id' | 'createdAt'> & {
    createdAt?: number;
  }
): Promise<void> {
  if (env.AVATAR_REVIEW_REPOSITORY)
    return env.AVATAR_REVIEW_REPOSITORY.recordAudit(input);
  await requireD1(env)
    .prepare(
      `INSERT INTO public_avatar_audit (
      id, username, actor_email, actor_kind, action, previous_sha256, sha256,
      review_id, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      input.username,
      input.actorEmail,
      input.actorKind,
      input.action,
      input.previousSha256,
      input.sha256,
      input.reviewId,
      input.note,
      input.createdAt ?? Date.now()
    )
    .run();
}

export async function listAvatarAudit(
  env: Env,
  username: string,
  limit = 50
): Promise<PublicAvatarAuditRecord[]> {
  if (env.AVATAR_REVIEW_REPOSITORY)
    return env.AVATAR_REVIEW_REPOSITORY.listAudit(username, limit);
  const bounded = Math.min(Math.max(1, Math.trunc(limit)), 100);
  const rows = await requireD1(env)
    .prepare(
      `SELECT ${AUDIT_COLUMNS} FROM public_avatar_audit
     WHERE username = ?
     ORDER BY created_at DESC, id DESC
     LIMIT ?`
    )
    .bind(username, bounded)
    .all<AuditRow>();
  return rows.results.map(toAudit);
}

export interface AvatarReviewRepository {
  create(input: Parameters<typeof createAvatarReview>[1]): Promise<void>;
  get(id: string): Promise<PublicAvatarReviewRecord | null>;
  mark(input: Parameters<typeof markAvatarReview>[1]): Promise<boolean>;
  reopen(id: string, reviewedAt: number): Promise<void>;
  getPendingForUser(
    username: string,
    id?: string
  ): Promise<PublicAvatarReviewRecord | null>;
  listPendingForUser(
    username: string,
    options: { limit?: number; submittedBefore?: number }
  ): Promise<PublicAvatarReviewRecord[]>;
  listPendingPage(input: {
    cursor?: PublicAvatarReviewCursor;
    limit: number;
  }): Promise<PublicAvatarReviewPage>;
  cancelPending(
    input: Parameters<typeof cancelPendingAvatarReviews>[1]
  ): Promise<PublicAvatarReviewRecord[]>;
  hasPendingObject(username: string, sha256: string): Promise<boolean>;
  recordAudit(input: Parameters<typeof recordAvatarAudit>[1]): Promise<void>;
  listAudit(
    username: string,
    limit: number
  ): Promise<PublicAvatarAuditRecord[]>;
}
