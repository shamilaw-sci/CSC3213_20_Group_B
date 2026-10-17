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

/**
 * Sends an email via the custom mailer REST API.
 *
 * @param payload  The email content and recipients.
 * @param apiUrl   Base URL of the mailer API (e.g. "https://mailer.example.com").
 * @param apiKey   Bearer token for authentication.
 * @returns        Parsed response from the mailer API.
 */
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
