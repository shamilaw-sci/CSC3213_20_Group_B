import { z } from 'zod';

const verifyMagicCodeRequestSchema = z
  .object({
    email: z.string().min(1),
    code: z.string().min(1),
  })
  .transform(({ email, code }) => ({
    email: email.trim().toLowerCase(),
    code,
  }));

type VerifyMagicCodeRequestDto = z.infer<typeof verifyMagicCodeRequestSchema>;

type VerifyMagicCodeRequestDtoErrorCode =
  | 'invalid_body'
  | 'email_required'
  | 'email_invalid'
  | 'code_required'
  | 'code_invalid';

interface VerifyMagicCodeRequestDtoError {
  code: VerifyMagicCodeRequestDtoErrorCode;
  field?: 'email' | 'code';
  message: string;
}

export type VerifyMagicCodeRequestDtoResult =
  | { ok: true; value: VerifyMagicCodeRequestDto }
  | { ok: false; error: VerifyMagicCodeRequestDtoError };

export function parseVerifyMagicCodeRequestDto(
  input: unknown
): VerifyMagicCodeRequestDtoResult {
  const result = verifyMagicCodeRequestSchema.safeParse(input);
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

  const field = issue.path[0] === 'email' ? 'email' : 'code';
  const record =
    typeof input === 'object' && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : null;
  const required =
    record !== null &&
    (!(field in record) || record[field] === undefined || record[field] === '');

  return {
    ok: false,
    error: required
      ? {
          code: `${field}_required`,
          field,
          message: `${field === 'email' ? 'Email' : 'Code'} is required`,
        }
      : {
          code: `${field}_invalid`,
          field,
          message: `${field === 'email' ? 'Email' : 'Code'} must be a string`,
        },
  };
}
