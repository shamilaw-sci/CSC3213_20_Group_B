import { createTransport } from 'nodemailer';
import { render } from '@react-email/render';

import { env } from '@/config/env';
import { PortalSignInOtpEmail } from '@/emails/portal-sign-in-otp.email';
import type { SendRequest } from '@/types';

interface ResolvedMailMessage {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

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

export async function resolveMailMessage(
  payload: SendRequest
): Promise<ResolvedMailMessage> {
  if ('template' in payload) {
    const email = PortalSignInOtpEmail(payload.template.props);
    return {
      to: payload.to,
      subject: 'SCS Portal sign-in code',
      html: await render(email),
      text: await render(email, { plainText: true }),
    };
  }

  return payload;
}

export async function sendMail(payload: SendRequest): Promise<{ ok: true }> {
  const message = await resolveMailMessage(payload);
  await transporter.sendMail({
    from: env.SMTP_FROM,
    ...message,
  });

  return { ok: true };
}
