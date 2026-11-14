import { describe, expect, test } from 'bun:test';

import { validateSendBody } from '@/validators/send.validator';

describe('mailer request validation', () => {
  test('accepts and normalizes a Portal sign-in OTP template request', () => {
    const body: unknown = {
      to: 'student@eng.pdn.ac.lk',
      template: {
        name: 'portal-sign-in-otp',
        origin: 'https://portal.scs-pdn.space',
        props: {
          otp: '123456',
          expiresInMinutes: 5,
        },
      },
    };

    validateSendBody(body);

    expect(body).toEqual({
      to: 'student@eng.pdn.ac.lk',
      template: {
        name: 'portal-sign-in-otp',
        origin: 'https://portal.scs-pdn.space',
        props: {
          otp: '123456',
          expiresInMinutes: 5,
        },
      },
    });
  });
});
