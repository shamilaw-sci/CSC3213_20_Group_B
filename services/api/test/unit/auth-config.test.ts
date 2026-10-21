import { describe, expect, test } from 'bun:test';

import { createAuth } from '@/auth/auth';
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
});
