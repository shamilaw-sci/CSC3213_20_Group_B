import { describe, expect, test } from 'bun:test';

import {
  createAuth,
  trustedOtpOrigin,
  validateAuthUserInfo,
} from '@/auth/auth';
import { createTestEnv } from 'test/helpers/create-test-env';

const PORTAL_ORIGIN = 'https://portal.scs-pdn.space';

test('binds OTP mail only to an explicitly trusted request origin', () => {
  const env = createTestEnv();
  for (const origin of [PORTAL_ORIGIN, 'https://portal.scs.pdn.ac.lk']) {
    expect(
      trustedOtpOrigin(
        new Request(
          'https://api.scs-pdn.space/api/auth/email-otp/send-verification-otp',
          {
            method: 'POST',
            headers: { Origin: origin },
          }
        ),
        env
      )
    ).toBe(origin);
  }

  expect(() =>
    trustedOtpOrigin(
      new Request(
        'https://api.scs-pdn.space/api/auth/email-otp/send-verification-otp',
        {
          method: 'POST',
          headers: {
            Origin: 'https://attacker.example',
            Host: 'portal.scs-pdn.space',
          },
        }
      ),
      env
    )
  ).toThrow('Portal OTP request origin is not trusted');
  expect(() =>
    trustedOtpOrigin(new Request('https://api.scs-pdn.space'), env)
  ).toThrow('Portal OTP request origin is not trusted');

  expect(
    trustedOtpOrigin(
      new Request(
        'https://api.scs-pdn.space/api/auth/email-otp/send-verification-otp',
        {
          method: 'POST',
          headers: { Referer: `${PORTAL_ORIGIN}/login` },
        }
      ),
      env
    )
  ).toBe(PORTAL_ORIGIN);
  expect(() =>
    trustedOtpOrigin(
      new Request(
        'https://api.scs-pdn.space/api/auth/email-otp/send-verification-otp',
        {
          method: 'POST',
          headers: { Referer: 'https://attacker.example/login' },
        }
      ),
      env
    )
  ).toThrow('Portal OTP request origin is not trusted');

  const stagingOrigin = 'https://portal.staging.example';
  expect(
    trustedOtpOrigin(
      new Request(
        'https://api.staging.example/api/auth/email-otp/send-verification-otp',
        {
          method: 'POST',
          headers: { Origin: stagingOrigin },
        }
      ),
      createTestEnv({ ALLOWED_ORIGINS: [stagingOrigin] })
    )
  ).toBe(stagingOrigin);
});

describe('Better Auth account-linking policy', () => {
  test('links exact verified OAuth emails to verified migrated users', () => {
    const auth = createAuth(
      new Request('https://api.scs-pdn.space/api/auth/ok', {
        headers: { Origin: PORTAL_ORIGIN },
      }),
      createTestEnv({ BETTER_AUTH_URL: 'https://api.scs-pdn.space' })
    );

    expect(auth.options.socialProviders?.google?.requireEmailVerification).toBe(
      true
    );
    expect(auth.options.account?.accountLinking).toMatchObject({
      enabled: true,
      disableImplicitLinking: false,
      requireLocalEmailVerified: true,
      trustedProviders: [],
      allowDifferentEmails: false,
      allowUnlinkingAll: false,
    });
  });

  test('accepts a personal email when its GitHub account is already linked', () => {
    expect(
      validateAuthUserInfo({
        user: { email: 'developer@example.com' },
        source: {
          action: 'sign-in',
          method: 'oauth',
          oauth: { providerId: 'github' },
        },
      })
    ).toBeUndefined();
  });

  test('requires a university email when GitHub would create a user', () => {
    expect(
      validateAuthUserInfo({
        user: { email: 'developer@example.com' },
        source: {
          action: 'create-user',
          method: 'oauth',
          oauth: { providerId: 'github' },
        },
      })
    ).toEqual({
      error: 'university_email_required',
      errorDescription: 'Use a University of Peradeniya email address.',
    });
  });

  test('requires a university email for non-GitHub OAuth identities', () => {
    expect(
      validateAuthUserInfo({
        user: { email: 'developer@example.com' },
        source: {
          action: 'sign-in',
          method: 'oauth',
          oauth: { providerId: 'google' },
        },
      })
    ).toEqual({
      error: 'university_email_required',
      errorDescription: 'Use a University of Peradeniya email address.',
    });
  });

  test('accepts university email identities at the authentication boundary', () => {
    expect(
      validateAuthUserInfo({
        user: { email: 'student@sci.pdn.ac.lk' },
        source: { action: 'create-user', method: 'email' },
      })
    ).toBeUndefined();
  });
});
