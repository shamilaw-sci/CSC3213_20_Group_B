import { COOKIE_MAX_AGE } from '@/config/client.config';
import type { Env } from '@/types/env';

/**
 * get to know weather the token is revoked or not
 */
export async function isTokenRevoked(jti: string, env: Env): Promise<boolean> {
  const revoked = await env.TOKEN_BLACKLIST.get(jti);
  return revoked === 'revoked';
}

/**
 * get the token as revoked
 */
export async function revokeToken(
  jti: string,
  ttl: number | null,
  env: Env
): Promise<void> {
  if (ttl) {
    await env.TOKEN_BLACKLIST.put(jti, 'revoked', { expirationTtl: ttl });
  } else {
    await env.TOKEN_BLACKLIST.put(jti, 'revoked', {
      expirationTtl: COOKIE_MAX_AGE,
    }); // Default is same as cookie max age
  }
}
