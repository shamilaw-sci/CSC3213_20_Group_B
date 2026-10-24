import { describe, expect, test } from 'bun:test';

import { MailerSendRequestSchema } from '#index';

describe('mailer send request contract', () => {
  test('exports a shared request schema for API and mailer callers', () => {
    expect(MailerSendRequestSchema).toBeDefined();
  });

  test('accepts a validated Portal sign-in OTP template request', () => {
    const result = MailerSendRequestSchema.safeParse({
      to: 'student@eng.pdn.ac.lk',
      template: {
        name: 'portal-sign-in-otp',
        props: {
          otp: '123456',
          expiresInMinutes: 5,
        },
      },
    });

    expect(result.success).toBe(true);
  });

  test('rejects malformed OTP template props at the service boundary', () => {
    const result = MailerSendRequestSchema.safeParse({
      to: 'student@eng.pdn.ac.lk',
      template: {
        name: 'portal-sign-in-otp',
        props: {
          otp: '<strong>123456</strong>',
          expiresInMinutes: 0,
        },
      },
    });

    expect(result.success).toBe(false);
  });

  test('keeps existing raw email requests compatible', () => {
    const result = MailerSendRequestSchema.safeParse({
      to: ['student@eng.pdn.ac.lk'],
      subject: 'Existing notification',
      html: '<p>Existing HTML</p>',
      text: 'Existing plain text',
    });

    expect(result.success).toBe(true);
  });
});
