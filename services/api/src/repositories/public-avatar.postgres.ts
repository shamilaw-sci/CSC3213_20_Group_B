import type { Pool } from 'pg';

import {
  toAudit,
  toReview,
  type AuditRow,
  type AvatarReviewRepository,
  type ReviewRow,
} from '@/repositories/public-avatar.repo';

const REVIEW_COLUMNS = `id, username, sha256, object_key AS "objectKey", size,
  moderation_json::text AS "moderationJson", status, submitted_at AS "submittedAt",
  reviewed_at AS "reviewedAt", reviewed_by AS "reviewedBy", review_note AS note`;
const AUDIT_COLUMNS = `id, username, actor_email AS "actorEmail", actor_kind AS "actorKind",
  action, previous_sha256 AS "previousSha256", sha256, review_id AS "reviewId",
  note, created_at AS "createdAt"`;

function safeTime(value: string | number | null): number | null {
  if (value === null) return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number))
    throw new Error('Invalid avatar timestamp');
  return number;
}

function review(row: ReviewRow) {
  return toReview({
    ...row,
    submittedAt: safeTime(row.submittedAt)!,
    reviewedAt: safeTime(row.reviewedAt),
  });
}

function audit(row: AuditRow) {
  return toAudit({ ...row, createdAt: safeTime(row.createdAt)! });
}

export function createPostgresAvatarReviewRepository(
  pool: Pool
): AvatarReviewRepository {
  return {
    async create(input) {
      await pool.query(
        `INSERT INTO public_avatar_review (id, username, sha256, object_key, size, moderation_json, status, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'pending', $7)`,
        [
          input.id,
          input.username,
          input.sha256,
          input.objectKey,
          input.size,
          JSON.stringify(input.moderation),
          input.submittedAt,
        ]
      );
    },
    async get(id) {
      const result = await pool.query<ReviewRow>(
        `SELECT ${REVIEW_COLUMNS} FROM public_avatar_review WHERE id = $1 LIMIT 1`,
        [id]
      );
      return result.rows[0] ? review(result.rows[0]) : null;
    },
    async mark(input) {
      const result = await pool.query(
        `UPDATE public_avatar_review SET status = $1, reviewed_at = $2, reviewed_by = $3, review_note = $4
         WHERE id = $5 AND status = 'pending' RETURNING id`,
        [
          input.status,
          input.reviewedAt,
          input.reviewedBy,
          input.note ?? null,
          input.id,
        ]
      );
      return result.rowCount === 1;
    },
    async reopen(id, reviewedAt) {
      await pool.query(
        `UPDATE public_avatar_review SET status = 'pending', reviewed_at = NULL, reviewed_by = NULL, review_note = NULL
         WHERE id = $1 AND status = 'approved' AND reviewed_at = $2`,
        [id, reviewedAt]
      );
    },
    async getPendingForUser(username, id) {
      const result = id
        ? await pool.query<ReviewRow>(
            `SELECT ${REVIEW_COLUMNS} FROM public_avatar_review WHERE username = $1 AND id = $2 AND status = 'pending' LIMIT 1`,
            [username, id]
          )
        : await pool.query<ReviewRow>(
            `SELECT ${REVIEW_COLUMNS} FROM public_avatar_review WHERE username = $1 AND status = 'pending' ORDER BY submitted_at DESC, id DESC LIMIT 1`,
            [username]
          );
      return result.rows[0] ? review(result.rows[0]) : null;
    },
    async listPendingForUser(username, options) {
      const limit = options.limit ?? 50;
      const result =
        options.submittedBefore === undefined
          ? await pool.query<ReviewRow>(
              `SELECT ${REVIEW_COLUMNS} FROM public_avatar_review WHERE username = $1 AND status = 'pending' ORDER BY submitted_at DESC, id DESC LIMIT $2`,
              [username, limit]
            )
          : await pool.query<ReviewRow>(
              `SELECT ${REVIEW_COLUMNS} FROM public_avatar_review WHERE username = $1 AND status = 'pending' AND submitted_at <= $2 ORDER BY submitted_at DESC, id DESC LIMIT $3`,
              [username, options.submittedBefore, limit]
            );
      return result.rows.map(review);
    },
    async listPendingPage(input) {
      const result = input.cursor
        ? await pool.query<ReviewRow>(
            `SELECT ${REVIEW_COLUMNS} FROM public_avatar_review WHERE status = 'pending' AND (submitted_at < $1 OR (submitted_at = $1 AND id < $2)) ORDER BY submitted_at DESC, id DESC LIMIT $3`,
            [input.cursor.submittedAt, input.cursor.id, input.limit + 1]
          )
        : await pool.query<ReviewRow>(
            `SELECT ${REVIEW_COLUMNS} FROM public_avatar_review WHERE status = 'pending' ORDER BY submitted_at DESC, id DESC LIMIT $1`,
            [input.limit + 1]
          );
      const pageRows = result.rows.slice(0, input.limit);
      const last = pageRows.at(-1);
      return {
        items: pageRows.map(review),
        nextCursor:
          result.rows.length > input.limit && last
            ? { submittedAt: safeTime(last.submittedAt)!, id: last.id }
            : null,
      };
    },
    async cancelPending(input) {
      const result = await pool.query<ReviewRow>(
        `UPDATE public_avatar_review SET status = 'rejected', reviewed_at = $1, reviewed_by = $2, review_note = $3
         WHERE username = $4 AND status = 'pending' AND submitted_at < $5 RETURNING ${REVIEW_COLUMNS}`,
        [
          input.reviewedAt,
          input.reviewedBy,
          input.note,
          input.username,
          input.submittedBefore,
        ]
      );
      return result.rows.map(review);
    },
    async hasPendingObject(username, sha256) {
      const result = await pool.query(
        'SELECT 1 FROM public_avatar_review WHERE username = $1 AND sha256 = $2 AND status = $3 LIMIT 1',
        [username, sha256, 'pending']
      );
      return result.rowCount !== 0;
    },
    async recordAudit(input) {
      await pool.query(
        `INSERT INTO public_avatar_audit (id, username, actor_email, actor_kind, action, previous_sha256, sha256, review_id, note, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          crypto.randomUUID(),
          input.username,
          input.actorEmail,
          input.actorKind,
          input.action,
          input.previousSha256,
          input.sha256,
          input.reviewId,
          input.note,
          input.createdAt ?? Date.now(),
        ]
      );
    },
    async listAudit(username, limit) {
      const bounded = Math.min(Math.max(1, Math.trunc(limit)), 100);
      const result = await pool.query<AuditRow>(
        `SELECT ${AUDIT_COLUMNS} FROM public_avatar_audit WHERE username = $1 ORDER BY created_at DESC, id DESC LIMIT $2`,
        [username, bounded]
      );
      return result.rows.map(audit);
    },
  };
}
