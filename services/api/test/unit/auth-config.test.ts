import { describe, expect, test } from 'bun:test';

import { createAuth, validateAuthUserInfo } from '@/auth/auth';
import { createTestEnv } from 'test/helpers/create-test-env';

const PORTAL_ORIGIN = 'https://portal.scs-pdn.space';

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
