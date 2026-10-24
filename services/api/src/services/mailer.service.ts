import type { MailerSendRequest, PortalSignInOtpRequest } from '@scs/schemas';

export interface MailerSendResponse {
  ok: boolean;
  error?: string;
}

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

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mailer API error ${res.status}: ${body}`);
  }

  return res.json();
}

export async function sendPortalSignInOtpEmail(
  to: string,
  otp: string,
  expiresInMinutes: number,
  apiUrl: string,
  apiKey: string
): Promise<MailerSendResponse> {
  const payload = {
    to,
    template: {
      name: 'portal-sign-in-otp',
      props: { otp, expiresInMinutes },
    },
  } satisfies PortalSignInOtpRequest;

  return sendEmail(payload, apiUrl, apiKey);
}
