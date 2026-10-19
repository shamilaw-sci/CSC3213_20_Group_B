import { createHash, timingSafeEqual } from 'node:crypto';

import { createMiddleware } from 'hono/factory';

import type { GithubAppEnv } from '@/types/env';

export function secureSecretEqual(actual: string, expected: string): boolean {
  const actualDigest = createHash('sha256').update(actual).digest();
  const expectedDigest = createHash('sha256').update(expected).digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

/**
 * Verifies that the caller is the trusted upstream internal service.
 */
export const auth = createMiddleware<{ Bindings: GithubAppEnv }>(
  async (c, next) => {
    const internalSecret = c.req.header('X-Internal-Secret') ?? '';
    if (!secureSecretEqual(internalSecret, c.env.X_INTERNAL_SECRET)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    await next();
  }
);
