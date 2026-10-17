import { z } from 'zod';

const magicCodeRequestSchema = z
  .object({
    email: z.string().min(1),
  })
  .transform(({ email }) => ({ email: email.trim().toLowerCase() }));

type MagicCodeRequestDto = z.infer<typeof magicCodeRequestSchema>;

type MagicCodeRequestDtoErrorCode =
  'invalid_body' | 'email_required' | 'email_invalid';

interface MagicCodeRequestDtoError {
  code: MagicCodeRequestDtoErrorCode;
  field?: 'email';
  message: string;
}

export type MagicCodeRequestDtoResult =
  | { ok: true; value: MagicCodeRequestDto }
  | { ok: false; error: MagicCodeRequestDtoError };

export function parseMagicCodeRequestDto(
  input: unknown
): MagicCodeRequestDtoResult {
  const result = magicCodeRequestSchema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };

  const issue = result.error.issues[0];
  if (issue.path.length === 0) {
    return {
      ok: false,
      error: {
        code: 'invalid_body',
        message: 'Request body must be an object',
      },
    };
  }

  const required =
    typeof input === 'object' &&
    input !== null &&
    !Array.isArray(input) &&
    (!('email' in input) || input.email === undefined || input.email === '');
  return {
    ok: false,
    error: required
      ? {
          code: 'email_required',
          field: 'email',
          message: 'Email is required',
        }
      : {
          code: 'email_invalid',
          field: 'email',
          message: 'Email must be a string',
        },
  };
}
