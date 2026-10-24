import { sendRequestSchema, type SendRequest } from '@/types';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateSendBody(body: unknown): asserts body is SendRequest {
  const result = sendRequestSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError(
      result.error.issues[0]?.message ?? 'Invalid request'
    );
  }

  Object.assign(body as object, result.data);
}
