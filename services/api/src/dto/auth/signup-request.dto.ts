import { z } from 'zod';

const signupRequestSchema = z
  .object({
    email: z.string().min(1),
    name: z.string().optional(),
    picture: z.string().optional(),
  })
  .transform(({ email, name, picture }) => {
    const value: SignupRequestDto = { email: email.trim().toLowerCase() };
    const trimmedName = name?.trim();
    const trimmedPicture = picture?.trim();

    if (trimmedName) value.name = trimmedName;
    if (trimmedPicture) value.picture = trimmedPicture;
    return value;
  });

type SignupRequestDto = {
  email: string;
  name?: string;
  picture?: string;
};

type SignupRequestDtoErrorCode =
  | 'invalid_body'
  | 'email_required'
  | 'email_invalid'
  | 'name_invalid'
  | 'picture_invalid';

interface SignupRequestDtoError {
  code: SignupRequestDtoErrorCode;
  field?: 'email' | 'name' | 'picture';
  message: string;
}

export type SignupRequestDtoResult =
  | { ok: true; value: SignupRequestDto }
  | { ok: false; error: SignupRequestDtoError };

export function parseSignupRequestDto(input: unknown): SignupRequestDtoResult {
  const result = signupRequestSchema.safeParse(input);
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

  const field = issue.path[0];
  if (field === 'email') {
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

  if (field === 'name') {
    return {
      ok: false,
      error: {
        code: 'name_invalid',
        field: 'name',
        message: 'Name must be a string',
      },
    };
  }

  return {
    ok: false,
    error: {
      code: 'picture_invalid',
      field: 'picture',
      message: 'Picture must be a string',
    },
  };
}
