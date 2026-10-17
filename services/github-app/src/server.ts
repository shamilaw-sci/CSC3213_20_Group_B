import envConfig from '@/config/env.config';
import app from '@/index';

/**
 * Starts the Hono app on Bun's native HTTP server.
 */
Bun.serve({
  port: envConfig.PORT,
  fetch: app.fetch,
});

console.log(`Listening on http://localhost:${envConfig.PORT}`);
