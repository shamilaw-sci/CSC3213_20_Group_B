import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { bearerAuth } from 'hono/bearer-auth';
import { HTTPException } from 'hono/http-exception';

import { env } from '@/config/env';
import sendRoute from '@/routes/send.route';
import type { SendResponse } from '@/types';

const app = new Hono();

app.use('/favicon.ico', serveStatic({ path: './public/favicon.ico' }));

app.use('/send', bearerAuth({ token: env.MAILER_API_KEY }));

app.route('/send', sendRoute);

app.notFound((c) =>
  c.json<SendResponse>({ ok: false, error: 'Not found' }, 404)
);

app.onError(async (err, c) => {
  if (err instanceof HTTPException) {
    const message = (await err.res?.text()) || 'HTTP Exception';
    return c.json<SendResponse>({ ok: false, error: message }, err.status);
  }
  console.error('Unhandled error:', err);
  return c.json<SendResponse>(
    { ok: false, error: 'Internal server error' },
    500
  );
});

export default app;
