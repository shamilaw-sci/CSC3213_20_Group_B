export interface MailerSendRequest {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

export interface MailerSendResponse {
  ok: boolean;
  error?: string;
}

export async function sendEmail(
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
