import { parseStudentIdentifier, type ReviewStatus } from '@scs/identity';
import {
  type AppRole,
  type IdentityAccount,
  IdentityAccountSchema,
  type IdentityAudit,
  IdentityAuditSchema,
} from '@scs/schemas';

import type { Env } from '@/types/env';
import { requireD1 } from '@/types/env';
import {
  ACCESS_LEVEL,
  LastSuperAdminError,
  permissionUserData,
  sanitizePermission,
  type Permission,
} from '@/repositories/permissions.repo';

interface AccountRow extends Omit<
  IdentityAccount,
  'emailVerified' | 'status' | 'source' | 'note' | 'createdAt' | 'reviewedAt'
> {
  createdAt: number | string | null;
  reviewedAt: number | string | null;
  emailVerified: number | boolean;
  status: ReviewStatus | null;
  source: string | null;
  note: string | null;
}

export async function listIdentityAccounts(
  env: Env,
  input: {
    query: string;
    role?: AppRole;
    status?: ReviewStatus;
    verified?: 'all' | 'verified' | 'unverified';
    cursor?: string;
    limit: number;
  }
): Promise<{ items: IdentityAccount[]; nextCursor: string | null }> {
  const query = `%${input.query.toLowerCase().replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
  const params: Array<string | number> = [input.cursor ?? '', query, query];
  const pg = Boolean(env.AUTH_DATABASE);
  const placeholder = (index: number) => (pg ? `$${index}` : '?');
  const conditions = [
    `p.email > ${placeholder(1)}`,
    `(lower(p.email) LIKE ${placeholder(2)} ESCAPE '\\' OR lower(p.name) LIKE ${placeholder(3)} ESCAPE '\\')`,
  ];
  if (input.role) {
    params.push(input.role);
    conditions.push(`p.role = ${placeholder(params.length)}`);
  }
  if (input.status) {
    params.push(input.status);
    conditions.push(
      `coalesce(r.status, 'PENDING') = ${placeholder(params.length)}`
    );
  }
  if (input.verified === 'verified')
    conditions.push(
      `u.${pg ? '"emailVerified"' : 'emailVerified'} = ${pg ? 'true' : '1'}`
    );
  if (input.verified === 'unverified')
    conditions.push(
      `u.${pg ? '"emailVerified"' : 'emailVerified'} = ${pg ? 'false' : '0'}`
    );
  params.push(input.limit + 1);
  const sql = `SELECT p.email, p.name, p.role, p.${pg ? '"accessLevel"' : 'accessLevel'} AS "accessLevel",
    p.${pg ? '"createdAt"' : 'createdAt'} AS "createdAt",
    u.${pg ? '"emailVerified"' : 'emailVerified'} AS "emailVerified",
    r.status, r.source, r.note, r.reviewed_by AS "reviewedBy", r.reviewed_at AS "reviewedAt"
    FROM permission p JOIN "user" u ON lower(u.email) = lower(p.email)
    LEFT JOIN identity_review r ON lower(r.email) = lower(p.email)
    WHERE ${conditions.join(' AND ')} ORDER BY p.email LIMIT ${placeholder(params.length)}`;
  const rows = env.AUTH_DATABASE
    ? (await env.AUTH_DATABASE.query<AccountRow>(sql, params)).rows
    : (
        await requireD1(env)
          .prepare(sql)
          .bind(...params)
          .all<AccountRow>()
      ).results;
  const page = rows.slice(0, input.limit);
  return {
    items: page.map((row) =>
      IdentityAccountSchema.parse({
        ...row,
        emailVerified: row.emailVerified === true || row.emailVerified === 1,
        createdAt: row.createdAt === null ? null : Number(row.createdAt),
        reviewedAt: row.reviewedAt === null ? null : Number(row.reviewedAt),
        status: row.status ?? 'PENDING',
        source:
          row.source ??
          (parseStudentIdentifier(row.email)
            ? 'STUDENT_PATTERN'
            : row.role === 'OTHER'
              ? 'AUTOMATIC'
              : 'EXISTING'),
        note: row.note ?? '',
      })
    ),
    nextCursor: rows.length > input.limit ? (page.at(-1)?.email ?? null) : null,
  };
}

export async function getIdentityHistory(
  env: Env,
  email: string
): Promise<IdentityAudit[]> {
  const sql = `SELECT id, email, old_role AS "oldRole", new_role AS "newRole", status, source,
    note, actor_email AS "reviewedBy", created_at AS "reviewedAt"
    FROM identity_audit WHERE lower(email) = lower(${env.AUTH_DATABASE ? '$1' : '?'})
    ORDER BY created_at DESC LIMIT 50`;
  const rows = env.AUTH_DATABASE
    ? (
        await env.AUTH_DATABASE.query<
          IdentityAudit & { reviewedAt: number | string }
        >(sql, [email])
      ).rows
    : (
        await requireD1(env)
          .prepare(sql)
          .bind(email)
          .all<IdentityAudit & { reviewedAt: number | string }>()
      ).results;
  return rows.map((row) =>
    IdentityAuditSchema.parse({ ...row, reviewedAt: Number(row.reviewedAt) })
  );
}

export async function getVerifiedStudentEmails(
  env: Env,
  emails: string[]
): Promise<Set<string>> {
  if (emails.length === 0) return new Set();
  const pg = Boolean(env.AUTH_DATABASE);
  const placeholders = emails
    .map((_, index) => (pg ? `$${index + 1}` : '?'))
    .join(', ');
  const sql = `SELECT lower(p.email) AS email FROM permission p
    JOIN "user" u ON lower(u.email) = lower(p.email)
    WHERE lower(p.email) IN (${placeholders}) AND p.role = 'STUDENT'
    AND u.${pg ? '"emailVerified"' : 'emailVerified'} = ${pg ? 'true' : '1'}`;
  const rows = env.AUTH_DATABASE
    ? (await env.AUTH_DATABASE.query<{ email: string }>(sql, emails)).rows
    : (
        await requireD1(env)
          .prepare(sql)
          .bind(...emails)
          .all<{ email: string }>()
      ).results;
  return new Set(rows.map((row) => row.email));
}

export async function saveIdentityDecision(
  env: Env,
  input: {
    email: string;
    oldRole: AppRole;
    role: AppRole;
    status: ReviewStatus;
    source: 'MANUAL' | 'REVIEW';
    note: string;
    actorEmail: string;
    nextPermission?: Permission;
    expectedPermission?: Permission;
  }
): Promise<void> {
  const now = Date.now();
  const id = crypto.randomUUID();
  const nextPermission = input.nextPermission
    ? sanitizePermission(input.nextPermission)
    : null;
  if (nextPermission && nextPermission.role !== input.role) {
    throw new Error('Identity decision and permission role disagree');
  }
  if (nextPermission && !input.expectedPermission) {
    throw new Error('Expected permission is required for an admin role edit');
  }
  const nextUser = nextPermission
    ? permissionUserData(input.email, nextPermission)
    : null;
  if (env.AUTH_DATABASE) {
    const client = await env.AUTH_DATABASE.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(81233017)');
      const current = await client.query<{
        role: AppRole;
        accessLevel: string;
        matchesExpected: boolean | null;
      }>(
        `SELECT role, "accessLevel", "permissionJson" = $2::jsonb AS "matchesExpected"
         FROM permission WHERE lower(email) = lower($1) FOR UPDATE`,
        [
          input.email,
          input.expectedPermission
            ? JSON.stringify(sanitizePermission(input.expectedPermission))
            : null,
        ]
      );
      if (current.rows[0]?.role !== input.oldRole) {
        throw new Error('Account role changed; refresh before reviewing');
      }
      if (input.expectedPermission && !current.rows[0].matchesExpected) {
        throw new Error('Account permissions changed; refresh before editing');
      }
      if (
        current.rows[0].accessLevel === ACCESS_LEVEL.SUPER_ADMIN &&
        nextPermission?.accessLevel !== undefined &&
        nextPermission.accessLevel !== ACCESS_LEVEL.SUPER_ADMIN
      ) {
        const other = await client.query(
          'SELECT 1 FROM permission WHERE "accessLevel" = $1 AND lower(email) <> lower($2) LIMIT 1',
          [ACCESS_LEVEL.SUPER_ADMIN, input.email]
        );
        if (other.rowCount === 0) throw new LastSuperAdminError();
      }
      if (nextPermission && nextUser) {
        await client.query(
          `UPDATE permission SET "permissionJson" = $1::jsonb, role = $2,
            "accessLevel" = $3, name = $4, picture = $5, blacklisted = $6,
            "createdAt" = $7 WHERE lower(email) = lower($8)`,
          [
            JSON.stringify(nextPermission),
            nextUser.role,
            nextUser.accessLevel,
            nextUser.name,
            nextUser.picture,
            nextUser.blacklisted ? 1 : 0,
            nextUser.createdAt ?? null,
            input.email,
          ]
        );
      } else {
        await client.query(
          `UPDATE permission SET role = $1,
            "permissionJson" = jsonb_set("permissionJson", '{role}', to_jsonb($1::text))
            WHERE lower(email) = lower($2)`,
          [input.role, input.email]
        );
      }
      await client.query(
        `INSERT INTO identity_review (email, status, source, note, reviewed_by, reviewed_at)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT(email) DO UPDATE SET status = excluded.status, source = excluded.source,
          note = excluded.note, reviewed_by = excluded.reviewed_by, reviewed_at = excluded.reviewed_at`,
        [
          input.email,
          input.status,
          input.source,
          input.note,
          input.actorEmail,
          now,
        ]
      );
      await client.query(
        `INSERT INTO identity_audit (id, email, old_role, new_role, status, source, note, actor_email, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          id,
          input.email,
          input.oldRole,
          input.role,
          input.status,
          input.source,
          input.note,
          input.actorEmail,
          now,
        ]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return;
  }
  const db = requireD1(env);
  const current = await db
    .prepare('SELECT role FROM permission WHERE email = ?')
    .bind(input.email)
    .first<{ role: AppRole }>();
  if (current?.role !== input.oldRole) {
    throw new Error('Account role changed; refresh before reviewing');
  }
  await db.batch([
    nextPermission && nextUser
      ? db
          .prepare(
            `UPDATE permission SET permissionJson = ?, role = ?, accessLevel = ?,
              name = ?, picture = ?, blacklisted = ?, createdAt = ?
              WHERE email = ? AND role = ? AND permissionJson = ?`
          )
          .bind(
            JSON.stringify(nextPermission),
            nextUser.role,
            nextUser.accessLevel,
            nextUser.name,
            nextUser.picture,
            nextUser.blacklisted ? 1 : 0,
            nextUser.createdAt ?? null,
            input.email,
            input.oldRole,
            JSON.stringify(sanitizePermission(input.expectedPermission!))
          )
      : db
          .prepare(
            `UPDATE permission SET role = ?, permissionJson = json_set(permissionJson, '$.role', ?)
              WHERE email = ? AND role = ?`
          )
          .bind(input.role, input.role, input.email, input.oldRole),
    db
      .prepare(
        `INSERT INTO identity_audit (id, email, old_role, new_role, status, source, note, actor_email, created_at)
      VALUES (CASE WHEN changes() = 1 THEN ? ELSE NULL END, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        input.email,
        input.oldRole,
        input.role,
        input.status,
        input.source,
        input.note,
        input.actorEmail,
        now
      ),
    db
      .prepare(
        `INSERT INTO identity_review (email, status, source, note, reviewed_by, reviewed_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET status = excluded.status, source = excluded.source,
      note = excluded.note, reviewed_by = excluded.reviewed_by, reviewed_at = excluded.reviewed_at`
      )
      .bind(
        input.email,
        input.status,
        input.source,
        input.note,
        input.actorEmail,
        now
      ),
  ]);
}
