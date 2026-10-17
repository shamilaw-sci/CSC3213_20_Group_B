import { createTransport } from 'nodemailer';

import { env } from '@/config/env';
import type { SendRequest } from '@/types';

const useSSL = Number(env.SMTP_PORT) === 465;

// Reusable Nodemailer transport — created once at module load.
const transporter = createTransport({
  host: env.SMTP_HOST,
  port: Number(env.SMTP_PORT) || (useSSL ? 465 : 587),
  secure: useSSL,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

/**
 * Sends a single transactional email via the configured SMTP transport.
 * Returns `{ ok: true }` on success; throws on SMTP / network failure
 * (caller is expected to catch and return a 502).
 */
export async function sendMail(payload: SendRequest): Promise<{ ok: true }> {
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });

  return { ok: true };
}
