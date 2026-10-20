import type { Env } from '@/types/env';

export interface AuthIdentity {
  userId: string;
  image?: string;
  providers: Set<string>;
  githubUserId?: number;
}

export async function getAuthIdentityByEmail(
  email: string,
  env: Env
): Promise<AuthIdentity | null> {
  const rows = await env.AUTH_DB.prepare(
    `SELECT u.id AS userId, u.image, a.providerId, a.accountId
     FROM "user" u
     LEFT JOIN account a ON a.userId = u.id
     WHERE lower(u.email) = ?`
  )
    .bind(email.toLowerCase())
    .all<{
      userId: string;
      image: string | null;
      providerId: string | null;
      accountId: string | null;
    }>();
  const first = rows.results[0];
  if (!first) return null;

  const githubAccount = rows.results.find(
    (account) => account.providerId === 'github'
  );
  const githubUserId = Number(githubAccount?.accountId);

  return {
    userId: first.userId,
    ...(first.image ? { image: first.image } : {}),
    providers: new Set(
      rows.results.flatMap((account) =>
        account.providerId ? [account.providerId] : []
      )
    ),
    ...(Number.isSafeInteger(githubUserId) && githubUserId > 0
      ? { githubUserId }
      : {}),
  };
}
