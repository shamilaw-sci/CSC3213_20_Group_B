import type { Pool, PoolClient } from 'pg';

import {
  ACCESS_LEVEL,
  APP_ROLE,
  LastSuperAdminError,
  type AppRole,
  type AccessLevel,
  type Permission,
  type PermissionRepository,
  type UserData,
  parsePermissionJson,
  permissionUserData,
  sanitizePermission,
} from '@/repositories/permissions.repo';

async function mutatePermission(
  pool: Pool,
  email: string,
  next: Permission | null
): Promise<void> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize super-admin removal checks across every API instance sharing this database.
    await client.query('SELECT pg_advisory_xact_lock(81233017)');
    const current = await client.query<{ accessLevel: AccessLevel }>(
      'SELECT "accessLevel" FROM permission WHERE lower(email) = lower($1)',
      [email]
    );
    if (
      current.rows[0]?.accessLevel === ACCESS_LEVEL.SUPER_ADMIN &&
      next?.accessLevel !== ACCESS_LEVEL.SUPER_ADMIN
    ) {
      const other = await client.query(
        'SELECT 1 FROM permission WHERE "accessLevel" = $1 AND lower(email) <> lower($2) LIMIT 1',
        [ACCESS_LEVEL.SUPER_ADMIN, email]
      );
      if (other.rowCount === 0) throw new LastSuperAdminError();
    }
    if (next) {
      const user = permissionUserData(email, next);
      await client.query(
        `INSERT INTO permission (email, "permissionJson", role, "accessLevel", name, picture, blacklisted, "createdAt")
         VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (email) DO UPDATE SET "permissionJson" = excluded."permissionJson", role = excluded.role,
           "accessLevel" = excluded."accessLevel", name = excluded.name, picture = excluded.picture,
           blacklisted = excluded.blacklisted, "createdAt" = excluded."createdAt"`,
        [
          email,
          JSON.stringify(next),
          user.role,
          user.accessLevel,
          user.name,
          user.picture,
          user.blacklisted ? 1 : 0,
          user.createdAt ?? null,
        ]
      );
    } else {
      await client.query(
        'DELETE FROM permission WHERE lower(email) = lower($1)',
        [email]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

interface PermissionRow {
  email: string;
  permissionJson: unknown;
  role: AppRole;
  accessLevel: AccessLevel;
  name: string;
  picture: string;
  blacklisted: number;
  createdAt: number | string | null;
}

export function createPostgresPermissionRepository(
  pool: Pool
): PermissionRepository {
  return {
    async hasOtherSuperAdmin(email) {
      const result = await pool.query(
        'SELECT 1 FROM permission WHERE "accessLevel" = $1 AND lower(email) <> lower($2) LIMIT 1',
        [ACCESS_LEVEL.SUPER_ADMIN, email]
      );
      return result.rowCount !== 0;
    },
    async get(email) {
      const result = await pool.query<Pick<PermissionRow, 'permissionJson'>>(
        'SELECT "permissionJson" FROM permission WHERE lower(email) = lower($1) LIMIT 1',
        [email]
      );
      return parsePermissionJson(result.rows[0]?.permissionJson);
    },
    async set(email, permission) {
      const normalizedEmail = email.toLowerCase();
      const sanitized = sanitizePermission(permission);
      await mutatePermission(pool, normalizedEmail, sanitized);
    },
    async delete(email) {
      await mutatePermission(pool, email.toLowerCase(), null);
    },
    async list(input) {
      const result = await pool.query<PermissionRow>(
        `SELECT email, name, picture, role, "accessLevel", blacklisted, "createdAt"
         FROM permission WHERE email > $1 ORDER BY email LIMIT $2`,
        [input.cursor ?? '', input.limit + 1]
      );
      const pageRows = result.rows.slice(0, input.limit);
      const users: UserData[] = pageRows.map((row) => ({
        id: row.email,
        email: row.email,
        name: row.name,
        picture: row.picture,
        role: row.role ?? APP_ROLE.USER,
        accessLevel: row.accessLevel ?? ACCESS_LEVEL.NONE,
        blacklisted: row.blacklisted === 1,
        ...(row.createdAt === null ? {} : { createdAt: Number(row.createdAt) }),
      }));
      return {
        users,
        nextCursor:
          result.rows.length > input.limit
            ? (pageRows.at(-1)?.email ?? null)
            : null,
      };
    },
  };
}
