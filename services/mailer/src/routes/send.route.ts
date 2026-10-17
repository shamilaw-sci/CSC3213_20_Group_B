import { Hono } from 'hono';

import { sendMail } from '@/services/mailer.service';
import type { SendResponse } from '@/types';
import { validateSendBody, ValidationError } from '@/validators/send.validator';

const route = new Hono();

// POST /send — sends a transactional email.
// Auth is enforced upstream by bearerAuth middleware in app.ts.
route.post('/', async (c) => {
  // --- parse JSON body -----------------------------------------------------
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json<SendResponse>(
      { ok: false, error: 'Request body must be valid JSON' },
      400
    );
  }

  // --- validate ------------------------------------------------------------
  try {
    validateSendBody(body);
  } catch (err) {
    if (err instanceof ValidationError) {
      return c.json<SendResponse>({ ok: false, error: err.message }, 400);
    }
    throw err;
  }

  // --- send ----------------------------------------------------------------
  try {
    const result = await sendMail(body);
    return c.json(result, 200);
  } catch (err) {
    console.error('SMTP send failed:', err);
    return c.json<SendResponse>(
      { ok: false, error: 'Failed to send email' },
      502
    );
  }
});

export default route;
