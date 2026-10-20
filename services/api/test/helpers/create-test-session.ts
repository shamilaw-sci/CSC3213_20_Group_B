import type { Env } from '@/types/env';

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function signCookie(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(value)
  );
  return `${value}.${toBase64(new Uint8Array(signature))}`;
}

export async function createTestSessionCookie(
  env: Env,
  email: string,
  name = 'Test User'
): Promise<string> {
  const normalizedEmail = email.toLowerCase();
  const userId = `user-${crypto.randomUUID()}`;
  const sessionId = `session-${crypto.randomUUID()}`;
  const token = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = new Date().getTime() + 24 * 60 * 60 * 1000;

  const existing = await env.AUTH_DB.prepare(
    'SELECT id FROM "user" WHERE email = ? LIMIT 1'
  )
    .bind(normalizedEmail)
    .first<{ id: string }>();
  const resolvedUserId = existing?.id ?? userId;
  if (!existing) {
    await env.AUTH_DB.prepare(
      'INSERT INTO "user" (id, name, email, emailVerified, image, createdAt, updatedAt) VALUES (?, ?, ?, 1, NULL, ?, ?)'
    )
      .bind(resolvedUserId, name, normalizedEmail, now, now)
      .run();
  }
  await env.AUTH_DB.prepare(
    'INSERT INTO "session" (id, expiresAt, token, createdAt, updatedAt, ipAddress, userAgent, userId) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)'
  )
    .bind(sessionId, expiresAt, token, now, now, resolvedUserId)
    .run();

  return `__Secure-scs-auth.session_token=${await signCookie(token, env.BETTER_AUTH_SECRET)}`;
}
