import { Hono } from 'hono';
import type { MailerSendResponse } from '@scs/schemas';

import { sendMail } from '@/services/mailer.service';
import { validateSendBody, ValidationError } from '@/validators/send.validator';

const route = new Hono();

route.post('/', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json<MailerSendResponse>(
      { ok: false, error: 'Request body must be valid JSON' },
      400
    );
  }

  try {
    validateSendBody(body);
  } catch (err) {
    if (err instanceof ValidationError) {
      return c.json<MailerSendResponse>({ ok: false, error: err.message }, 400);
    }
    throw err;
  }

  try {
    const result = await sendMail(body);
    return c.json(result, 200);
  } catch (err) {
    console.error('SMTP send failed:', err);
    return c.json<MailerSendResponse>(
      { ok: false, error: 'Failed to send email' },
      502
    );
  }
});

export default route;
