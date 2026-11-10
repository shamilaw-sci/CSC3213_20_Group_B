import type { Pool } from 'pg';

import {
  authIdentityFromRows,
  type AuthIdentityRepository,
  type AuthIdentityRow,
} from '@/repositories/auth-accounts.repo';

/** Bun/Node adapter for Better Auth's PostgreSQL user and account tables. */
export function createPostgresAuthIdentityRepository(
  pool: Pool
): AuthIdentityRepository {
  return {
    async getByEmail(email) {
      const result = await pool.query<AuthIdentityRow>(
        `SELECT u.id AS "userId", u.image, a."providerId", a."accountId"
         FROM "user" u
         LEFT JOIN account a ON a."userId" = u.id
         WHERE lower(u.email) = $1`,
        [email.toLowerCase()]
      );
      return authIdentityFromRows(result.rows);
    },
  };
}
