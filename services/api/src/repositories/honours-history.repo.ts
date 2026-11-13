import {
  HonoursBulkApplyRequestSchema,
  type HonoursBulkChange,
  type HonoursHistoryStatus,
  type HonoursOperationHistoryEntry,
  HonoursOperationHistoryResponseSchema,
} from '@scs/schemas';
import type { z } from 'zod';

import type { Env } from '@/types/env';
import { requireD1 } from '@/types/env';

interface HistoryRow {
  operationId: string;
  actorEmail: string;
  batch: string;
  programme: string;
  operation: string;
  reason: string;
  changes: string | HonoursBulkChange[];
  createdAt: number | string;
  status: HonoursHistoryStatus;
  failureReason: string | null;
}

interface IntentRow extends HistoryRow {
  actorSubjectId: string | null;
  idempotencyKey: string | null;
  correlationId: string | null;
  applyJson: string | object | null;
  requestHash: string | null;
  attemptCount: number;
}

export interface HonoursIntent {
  operationId: string;
  actorEmail: string;
  actorSubjectId: string;
  idempotencyKey: string;
  correlationId: string;
  apply: z.infer<typeof HonoursBulkApplyRequestSchema>;
  requestHash: string;
  batch: string;
  programme: string;
  operation: 'assign' | 'change' | 'revoke';
  reason: string;
  changes: HonoursBulkChange[];
  status: HonoursHistoryStatus;
  attemptCount: number;
  createdAt: number;
}

function parseIntent(row: IntentRow): HonoursIntent {
  if (
    !row.actorSubjectId ||
    !row.idempotencyKey ||
    !row.correlationId ||
    !row.applyJson ||
    !row.requestHash
  )
    throw new Error('Honours intent is incomplete');
  return {
    operationId: row.operationId,
    actorEmail: row.actorEmail,
    actorSubjectId: row.actorSubjectId,
    idempotencyKey: row.idempotencyKey,
    correlationId: row.correlationId,
    apply: HonoursBulkApplyRequestSchema.parse(
      typeof row.applyJson === 'string'
        ? JSON.parse(row.applyJson)
        : row.applyJson
    ),
    requestHash: row.requestHash,
    batch: row.batch,
    programme: row.programme,
    operation: row.operation as HonoursIntent['operation'],
    reason: row.reason,
    changes:
      typeof row.changes === 'string'
        ? (JSON.parse(row.changes) as HonoursBulkChange[])
        : row.changes,
    status: row.status,
    attemptCount: Number(row.attemptCount),
    createdAt: Number(row.createdAt),
  };
}

export async function getHonoursIntent(
  env: Env,
  operationId: string
): Promise<HonoursIntent | null> {
  const sql = `SELECT operation_id AS "operationId", actor_email AS "actorEmail",
    actor_subject_id AS "actorSubjectId", idempotency_key AS "idempotencyKey",
    correlation_id AS "correlationId", apply_json AS "applyJson",
    request_hash AS "requestHash", batch, programme, action AS operation,
    reason, changes_json AS changes, created_at AS "createdAt", status,
    attempt_count AS "attemptCount"
    FROM honours_operation_history WHERE operation_id = ${env.AUTH_DATABASE ? '$1' : '?'}`;
  const row = env.AUTH_DATABASE
    ? (await env.AUTH_DATABASE.query<IntentRow>(sql, [operationId])).rows[0]
    : await requireD1(env).prepare(sql).bind(operationId).first<IntentRow>();
  return row ? parseIntent(row) : null;
}

export async function getActiveHonoursIntentByHash(
  env: Env,
  actorSubjectId: string,
  requestHash: string
): Promise<HonoursIntent | null> {
  const sql = `SELECT operation_id AS "operationId" FROM honours_operation_history
    WHERE actor_subject_id = ${env.AUTH_DATABASE ? '$1' : '?'}
    AND request_hash = ${env.AUTH_DATABASE ? '$2' : '?'}
    AND status IN ('pending_acceptance', 'accepted', 'processing', 'awaiting_publication')
    LIMIT 1`;
  const row = env.AUTH_DATABASE
    ? (
        await env.AUTH_DATABASE.query<{ operationId: string }>(sql, [
          actorSubjectId,
          requestHash,
        ])
      ).rows[0]
    : await requireD1(env)
        .prepare(sql)
        .bind(actorSubjectId, requestHash)
        .first<{ operationId: string }>();
  return row ? getHonoursIntent(env, row.operationId) : null;
}

export async function saveHonoursIntent(
  env: Env,
  intent: HonoursIntent
): Promise<HonoursIntent> {
  const params = [
    intent.operationId,
    intent.actorEmail,
    intent.batch,
    intent.programme,
    intent.operation,
    intent.reason,
    JSON.stringify(intent.changes),
    intent.createdAt,
    intent.actorSubjectId,
    intent.idempotencyKey,
    intent.correlationId,
    JSON.stringify(intent.apply),
    intent.requestHash,
    intent.createdAt,
  ];
  if (env.AUTH_DATABASE) {
    await env.AUTH_DATABASE.query(
      `INSERT INTO honours_operation_history
       (operation_id, actor_email, batch, programme, action, reason, changes_json,
        created_at, actor_subject_id, idempotency_key, correlation_id, apply_json,
        request_hash, status, next_attempt_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11,
               $12::jsonb, $13, 'pending_acceptance', $14)
       ON CONFLICT DO NOTHING`,
      params
    );
  } else {
    await requireD1(env)
      .prepare(
        `INSERT OR IGNORE INTO honours_operation_history
       (operation_id, actor_email, batch, programme, action, reason, changes_json,
        created_at, actor_subject_id, idempotency_key, correlation_id, apply_json,
        request_hash, status, next_attempt_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_acceptance', ?)`
      )
      .bind(...params)
      .run();
  }
  const stored =
    (await getHonoursIntent(env, intent.operationId)) ??
    (await getActiveHonoursIntentByHash(
      env,
      intent.actorSubjectId,
      intent.requestHash
    ));
  if (!stored) throw new Error('Honours intent disappeared after insert');
  return stored;
}

export async function listDueHonoursIntentIds(
  env: Env,
  now: number,
  limit = 20
): Promise<string[]> {
  const sql = `SELECT operation_id AS "operationId" FROM honours_operation_history
    WHERE status IN ('pending_acceptance', 'accepted', 'processing', 'awaiting_publication')
    AND apply_json IS NOT NULL
    AND next_attempt_at <= ${env.AUTH_DATABASE ? '$1' : '?'}
    AND lease_until <= ${env.AUTH_DATABASE ? '$2' : '?'}
    ORDER BY next_attempt_at, created_at LIMIT ${env.AUTH_DATABASE ? '$3' : '?'}`;
  const params = [now, now, limit];
  const rows = env.AUTH_DATABASE
    ? (await env.AUTH_DATABASE.query<{ operationId: string }>(sql, params)).rows
    : (
        await requireD1(env)
          .prepare(sql)
          .bind(...params)
          .all<{ operationId: string }>()
      ).results;
  return rows.map((row) => row.operationId);
}

export async function claimHonoursIntent(
  env: Env,
  operationId: string,
  now: number
): Promise<string | null> {
  const leaseToken = crypto.randomUUID();
  const sql = `UPDATE honours_operation_history SET lease_until = ${env.AUTH_DATABASE ? '$1' : '?'},
    lease_token = ${env.AUTH_DATABASE ? '$2' : '?'}, attempt_count = attempt_count + 1
    WHERE operation_id = ${env.AUTH_DATABASE ? '$3' : '?'}
    AND lease_until <= ${env.AUTH_DATABASE ? '$4' : '?'}
    AND next_attempt_at <= ${env.AUTH_DATABASE ? '$5' : '?'}
    AND status IN ('pending_acceptance', 'accepted', 'processing', 'awaiting_publication')`;
  const leaseUntil = now + 120_000;
  const params = [leaseUntil, leaseToken, operationId, now, now];
  if (env.AUTH_DATABASE)
    return (await env.AUTH_DATABASE.query(sql, params)).rowCount === 1
      ? leaseToken
      : null;
  const changed = (
    await requireD1(env)
      .prepare(sql)
      .bind(...params)
      .run()
  ).meta.changes;
  return changed === 1 ? leaseToken : null;
}

export async function renewHonoursIntentLease(
  env: Env,
  operationId: string,
  leaseToken: string,
  now: number
): Promise<boolean> {
  const renewed = now + 120_000;
  const sql = `UPDATE honours_operation_history SET lease_until = ${env.AUTH_DATABASE ? '$1' : '?'}
    WHERE operation_id = ${env.AUTH_DATABASE ? '$2' : '?'}
    AND lease_token = ${env.AUTH_DATABASE ? '$3' : '?'}
    AND lease_until > ${env.AUTH_DATABASE ? '$4' : '?'}`;
  const params = [renewed, operationId, leaseToken, now];
  const changed = env.AUTH_DATABASE
    ? (await env.AUTH_DATABASE.query(sql, params)).rowCount
    : (
        await requireD1(env)
          .prepare(sql)
          .bind(...params)
          .run()
      ).meta.changes;
  return changed === 1;
}

export async function updateHonoursIntent(
  env: Env,
  operationId: string,
  status: HonoursHistoryStatus,
  nextAttemptAt: number,
  lastError: string | null,
  leaseToken: string
): Promise<void> {
  const now = Date.now();
  const sql = `UPDATE honours_operation_history SET status = ${env.AUTH_DATABASE ? '$1' : '?'},
    next_attempt_at = ${env.AUTH_DATABASE ? '$2' : '?'}, lease_until = 0,
    lease_token = NULL,
    last_error = ${env.AUTH_DATABASE ? '$3' : '?'},
    accepted_at = CASE WHEN ${env.AUTH_DATABASE ? '$4' : '?'} IN
      ('accepted', 'processing', 'awaiting_publication', 'published')
      THEN COALESCE(accepted_at, ${env.AUTH_DATABASE ? '$5' : '?'}) ELSE accepted_at END
    WHERE operation_id = ${env.AUTH_DATABASE ? '$6' : '?'}
    AND lease_token = ${env.AUTH_DATABASE ? '$7' : '?'}`;
  const params = [
    status,
    nextAttemptAt,
    lastError,
    status,
    now,
    operationId,
    leaseToken,
  ];
  if (env.AUTH_DATABASE) await env.AUTH_DATABASE.query(sql, params);
  else
    await requireD1(env)
      .prepare(sql)
      .bind(...params)
      .run();
}

export async function recordHonoursOperation(
  env: Env,
  entry: Omit<HonoursOperationHistoryEntry, 'status' | 'failureReason'>
): Promise<void> {
  const params = [
    entry.operationId,
    entry.actorEmail,
    entry.batch,
    entry.programme,
    entry.operation,
    entry.reason,
    JSON.stringify(entry.changes),
    entry.createdAt,
  ];
  if (env.AUTH_DATABASE) {
    await env.AUTH_DATABASE.query(
      `INSERT INTO honours_operation_history
       (operation_id, actor_email, batch, programme, action, reason, changes_json, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
       ON CONFLICT (operation_id) DO NOTHING`,
      params
    );
    return;
  }
  await requireD1(env)
    .prepare(
      `INSERT OR IGNORE INTO honours_operation_history
     (operation_id, actor_email, batch, programme, action, reason, changes_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(...params)
    .run();
}

export async function listHonoursOperations(
  env: Env,
  input: {
    actorEmail?: string;
    cursor?: string;
  }
): Promise<z.infer<typeof HonoursOperationHistoryResponseSchema>> {
  const match = input.cursor
    ? /^(\d{1,16}):([A-Za-z0-9_-]{16,128})$/.exec(input.cursor)
    : null;
  if (input.cursor && !match) throw new Error('Invalid Honours history cursor');
  const pg = Boolean(env.AUTH_DATABASE);
  const params: Array<string | number> = [];
  const placeholder = (value: string | number) => {
    params.push(value);
    return pg ? `$${params.length}` : '?';
  };
  const conditions: string[] = [];
  if (input.actorEmail)
    conditions.push(
      `lower(actor_email) = lower(${placeholder(input.actorEmail)})`
    );
  if (match) {
    const timestamp = Number(match[1]);
    const operationId = match[2];
    conditions.push(
      `(created_at < ${placeholder(timestamp)} OR (created_at = ${placeholder(timestamp)} AND operation_id < ${placeholder(operationId)}))`
    );
  }
  const sql = `SELECT operation_id AS "operationId", actor_email AS "actorEmail", batch, programme,
    action AS operation, reason, changes_json AS changes, created_at AS "createdAt", status,
    last_error AS "failureReason"
    FROM honours_operation_history ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY created_at DESC, operation_id DESC LIMIT ${placeholder(21)}`;
  const rows = env.AUTH_DATABASE
    ? (await env.AUTH_DATABASE.query<HistoryRow>(sql, params)).rows
    : (
        await requireD1(env)
          .prepare(sql)
          .bind(...params)
          .all<HistoryRow>()
      ).results;
  const items = rows.slice(0, 20).map((row) => ({
    ...row,
    changes:
      typeof row.changes === 'string'
        ? (JSON.parse(row.changes) as unknown)
        : row.changes,
    createdAt: Number(row.createdAt),
    failureReason: row.status === 'failed' ? row.failureReason : null,
  }));
  const last = items.at(-1);
  return HonoursOperationHistoryResponseSchema.parse({
    items,
    nextCursor:
      rows.length > 20 && last ? `${last.createdAt}:${last.operationId}` : null,
  });
}
