import { describe, expect, test } from 'bun:test';

import { authConfig } from '@/config/auth.config';

describe('portal authentication configuration', () => {
  test('exposes magic-code and passkey behavior from one typed module', () => {
    expect(authConfig.magicCode).toEqual({
      length: 6,
      resendCooldownMs: 30_000,
      fallbackExpiresInSeconds: 300,
    });
    expect(authConfig.passkey).toEqual({
      maxCredentials: 4,
      maxNameLength: 64,
    });
  });
});
