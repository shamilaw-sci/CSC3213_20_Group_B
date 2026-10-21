import { createTransport } from 'nodemailer';

import { env } from '@/config/env';
import type { SendRequest } from '@/types';

/** Reuse one SMTP transport so warm requests can reuse pooled connections. */
const transporter = createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_SECURE ? 465 : 587,
  secure: env.SMTP_SECURE,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

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
