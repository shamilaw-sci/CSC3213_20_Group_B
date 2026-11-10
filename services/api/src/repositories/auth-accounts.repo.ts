import type { Env } from '@/types/env';

export interface AuthIdentity {
  userId: string;
  image?: string;
  providers: Set<string>;
  githubUserId?: number;
}

export interface AuthIdentityRepository {
  getByEmail(email: string): Promise<AuthIdentity | null>;
}

export interface AuthIdentityRow {
  userId: string;
  image: string | null;
  providerId: string | null;
  accountId: string | null;
}

export function authIdentityFromRows(
  rows: AuthIdentityRow[]
): AuthIdentity | null {
  const first = rows[0];
  if (!first) return null;

  const githubAccount = rows.find((account) => account.providerId === 'github');
  const githubUserId = Number(githubAccount?.accountId);

  return {
    userId: first.userId,
    ...(first.image ? { image: first.image } : {}),
    providers: new Set(
      rows.flatMap((account) =>
        account.providerId ? [account.providerId] : []
      )
    ),
    ...(Number.isSafeInteger(githubUserId) && githubUserId > 0
      ? { githubUserId }
      : {}),
  };
}

function createD1AuthIdentityRepository(
  db: D1Database
): AuthIdentityRepository {
  return {
    async getByEmail(email) {
      const rows = await db
        .prepare(
          `SELECT u.id AS userId, u.image, a.providerId, a.accountId
         FROM "user" u
         LEFT JOIN account a ON a.userId = u.id
         WHERE lower(u.email) = ?`
        )
        .bind(email.toLowerCase())
        .all<AuthIdentityRow>();
      return authIdentityFromRows(rows.results);
    },
  };
}

export async function getAuthIdentityByEmail(
  email: string,
  env: Env
): Promise<AuthIdentity | null> {
  return (
    env.AUTH_IDENTITY_REPOSITORY ?? createD1AuthIdentityRepository(env.AUTH_DB)
  ).getByEmail(email);
}
