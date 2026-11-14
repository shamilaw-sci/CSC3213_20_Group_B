import type {
  MailerSendRequest,
  MailerSendResponse,
  PortalSignInOtpRequest,
} from '@scs/schemas';
import { MailerSendResponseSchema } from '@scs/schemas';

async function sendEmail(
  payload: MailerSendRequest,
  apiUrl: string,
  apiKey: string
): Promise<MailerSendResponse> {
  const res = await fetch(`${apiUrl}/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const result = MailerSendResponseSchema.safeParse(
    await res.json().catch(() => null)
  );

  if (!res.ok) {
    const detail =
      result.success && !result.data.ok ? `: ${result.data.error}` : '';
    throw new Error(`Mailer API error ${res.status}${detail}`);
  }

  if (!result.success || !result.data.ok) {
    throw new Error('Mailer API returned an invalid response');
  }

  return result.data;
}

export async function sendPortalSignInOtpEmail(
  to: string,
  otp: string,
  expiresInMinutes: number,
  origin: string,
  apiUrl: string,
  apiKey: string
): Promise<MailerSendResponse> {
  const payload = {
    to,
    template: {
      name: 'portal-sign-in-otp',
      origin,
      props: { otp, expiresInMinutes },
    },
  } satisfies PortalSignInOtpRequest;

  return sendEmail(payload, apiUrl, apiKey);
}
