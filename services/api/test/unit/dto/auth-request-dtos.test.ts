import { describe, expect, test } from 'bun:test';

import { parseMagicCodeRequestDto } from '@/dto/auth/magic-code-request.dto';
import { parseSignupRequestDto } from '@/dto/auth/signup-request.dto';
import { parseVerifyMagicCodeRequestDto } from '@/dto/auth/verify-magic-code-request.dto';

describe('parseSignupRequestDto', () => {
  test('rejects non-object bodies', () => {
    for (const input of [null, [], 'body', 123]) {
      expect(parseSignupRequestDto(input)).toEqual({
        ok: false,
        error: {
          code: 'invalid_body',
          message: 'Request body must be an object',
        },
      });
    }
  });

  test('requires email', () => {
    for (const input of [{}, { email: '' }, { email: undefined }]) {
      expect(parseSignupRequestDto(input)).toEqual({
        ok: false,
        error: {
          code: 'email_required',
          field: 'email',
          message: 'Email is required',
        },
      });
    }
  });

  test('requires email to be a string', () => {
    expect(parseSignupRequestDto({ email: 123 })).toEqual({
      ok: false,
      error: {
        code: 'email_invalid',
        field: 'email',
        message: 'Email must be a string',
      },
    });
  });

  test('rejects non-string optional profile fields', () => {
    expect(
      parseSignupRequestDto({
        email: 'student@pdn.ac.lk',
        name: 123,
      })
    ).toEqual({
      ok: false,
      error: {
        code: 'name_invalid',
        field: 'name',
        message: 'Name must be a string',
      },
    });

    expect(
      parseSignupRequestDto({
        email: 'student@pdn.ac.lk',
        picture: true,
      })
    ).toEqual({
      ok: false,
      error: {
        code: 'picture_invalid',
        field: 'picture',
        message: 'Picture must be a string',
      },
    });
  });

  test('normalizes email while trimming optional profile fields', () => {
    expect(
      parseSignupRequestDto({
        email: ' Student@PDN.AC.LK ',
        name: '  Test Student  ',
        picture: '  https://images.example/student.png  ',
        ignored: 'value',
      })
    ).toEqual({
      ok: true,
      value: {
        email: 'student@pdn.ac.lk',
        name: 'Test Student',
        picture: 'https://images.example/student.png',
      },
    });
  });

  test('omits blank optional profile fields', () => {
    expect(
      parseSignupRequestDto({
        email: 'student@pdn.ac.lk',
        name: '   ',
        picture: '',
      })
    ).toEqual({
      ok: true,
      value: { email: 'student@pdn.ac.lk' },
    });
  });
});

describe('parseMagicCodeRequestDto', () => {
  test('rejects invalid body and email shapes', () => {
    expect(parseMagicCodeRequestDto(null)).toEqual({
      ok: false,
      error: {
        code: 'invalid_body',
        message: 'Request body must be an object',
      },
    });
    expect(parseMagicCodeRequestDto({})).toEqual({
      ok: false,
      error: {
        code: 'email_required',
        field: 'email',
        message: 'Email is required',
      },
    });
    expect(parseMagicCodeRequestDto({ email: undefined })).toEqual({
      ok: false,
      error: {
        code: 'email_required',
        field: 'email',
        message: 'Email is required',
      },
    });
    expect(parseMagicCodeRequestDto({ email: false })).toEqual({
      ok: false,
      error: {
        code: 'email_invalid',
        field: 'email',
        message: 'Email must be a string',
      },
    });
  });

  test('normalizes email and ignores unknown fields', () => {
    expect(
      parseMagicCodeRequestDto({
        email: ' Student@PDN.AC.LK ',
        ignored: true,
      })
    ).toEqual({
      ok: true,
      value: { email: 'student@pdn.ac.lk' },
    });
  });
});

describe('parseVerifyMagicCodeRequestDto', () => {
  test('rejects a non-object body', () => {
    expect(parseVerifyMagicCodeRequestDto([])).toEqual({
      ok: false,
      error: {
        code: 'invalid_body',
        message: 'Request body must be an object',
      },
    });
  });

  test('validates email before code', () => {
    expect(parseVerifyMagicCodeRequestDto({ code: '123456' })).toEqual({
      ok: false,
      error: {
        code: 'email_required',
        field: 'email',
        message: 'Email is required',
      },
    });
    expect(
      parseVerifyMagicCodeRequestDto({
        email: 123,
        code: '123456',
      })
    ).toEqual({
      ok: false,
      error: {
        code: 'email_invalid',
        field: 'email',
        message: 'Email must be a string',
      },
    });
  });

  test('requires code to be a non-empty string', () => {
    expect(
      parseVerifyMagicCodeRequestDto({
        email: 'student@pdn.ac.lk',
      })
    ).toEqual({
      ok: false,
      error: {
        code: 'code_required',
        field: 'code',
        message: 'Code is required',
      },
    });
    expect(
      parseVerifyMagicCodeRequestDto({
        email: 'student@pdn.ac.lk',
        code: undefined,
      })
    ).toEqual({
      ok: false,
      error: {
        code: 'code_required',
        field: 'code',
        message: 'Code is required',
      },
    });
    expect(
      parseVerifyMagicCodeRequestDto({
        email: 'student@pdn.ac.lk',
        code: 123456,
      })
    ).toEqual({
      ok: false,
      error: {
        code: 'code_invalid',
        field: 'code',
        message: 'Code must be a string',
      },
    });
  });

  test('normalizes email and preserves code without business validation', () => {
    expect(
      parseVerifyMagicCodeRequestDto({
        email: ' Student@PDN.AC.LK ',
        code: ' 12ab ',
        ignored: 'value',
      })
    ).toEqual({
      ok: true,
      value: {
        email: 'student@pdn.ac.lk',
        code: ' 12ab ',
      },
    });
  });
});
