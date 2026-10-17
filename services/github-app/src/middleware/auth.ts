import { createMiddleware } from 'hono/factory';

import envConfig from '@/config/env.config';

/**
 * Verifies that the caller is the trusted upstream internal service.
 */
export const auth = createMiddleware(async (c, next) => {
  const internalSecret = c.req.header('X-Internal-Secret');
  if (internalSecret !== envConfig.X_INTERNAL_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});
