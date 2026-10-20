import type { SendRequest } from '@/types';

const MAX_RECIPIENTS = 50;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateSendBody(body: unknown): asserts body is SendRequest {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be a JSON object');
  }

  const raw = body as Record<string, unknown>;
  const { subject, html, text } = raw;

  const recipients = Array.isArray(raw.to)
    ? raw.to
    : raw.to !== undefined
      ? [raw.to]
      : [];

  if (
    recipients.length === 0 ||
    recipients.length > MAX_RECIPIENTS ||
    !recipients.every((addr) => typeof addr === 'string' && addr.includes('@'))
  ) {
    throw new ValidationError(
      `"to" must be a valid email or an array of 1–${MAX_RECIPIENTS} valid email addresses`
    );
  }

  /* Preserve the assertion signature while passing normalized recipients downstream. */
  (body as Record<string, unknown>).to = recipients;

  if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
    throw new ValidationError(
      '"subject" is required and must be a non-empty string'
    );
  }

  const hasHtml = typeof html === 'string' && html.trim().length > 0;
  const hasText = typeof text === 'string' && text.trim().length > 0;

  if (!hasHtml && !hasText) {
    throw new ValidationError(
      'At least one of "html" or "text" must be provided and non-empty'
    );
  }
}
