import { createTransport } from 'nodemailer';
import { render } from '@react-email/render';
import type { MailerSendRequest } from '@scs/schemas';

import { env } from '@/config/env';
import { PortalSignInOtpEmail } from '@/emails/portal-sign-in-otp.email';

interface ResolvedMailMessage {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  otp?: { code: string; origin: string };
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
  payload: MailerSendRequest
): Promise<ResolvedMailMessage> {
  if ('template' in payload) {
    const email = PortalSignInOtpEmail(payload.template.props);
    return {
      to: payload.to,
      subject: `${payload.template.props.otp} - Your SCS Portal login code`,
      otp: {
        code: payload.template.props.otp,
        origin: payload.template.origin,
      },
      html: await render(email),
      text: await render(email, { plainText: true }),
    };
  }

  return payload;
}

export async function sendMail(
  payload: MailerSendRequest
): Promise<{ ok: true }> {
  const message = await resolveMailMessage(payload);
  await transporter.sendMail({
    from: env.SMTP_FROM,
    ...message,
  });

  return { ok: true };
}
