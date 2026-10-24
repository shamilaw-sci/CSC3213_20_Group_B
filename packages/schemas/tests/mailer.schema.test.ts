import { describe, expect, test } from 'bun:test';

import { MailerSendRequestSchema, MailerSendResponseSchema } from '#index';

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

describe('mailer send response contract', () => {
  test('accepts success and bounded failure responses', () => {
    expect(MailerSendResponseSchema.parse({ ok: true })).toEqual({ ok: true });
    expect(
      MailerSendResponseSchema.parse({ ok: false, error: 'Delivery failed' })
    ).toEqual({ ok: false, error: 'Delivery failed' });
  });

  test('requires an error only for failed sends', () => {
    expect(
      MailerSendResponseSchema.safeParse({ ok: false }).success
    ).toBeFalse();
    expect(
      MailerSendResponseSchema.safeParse({ ok: true, error: 'unexpected' })
        .success
    ).toBeFalse();
  });
});
