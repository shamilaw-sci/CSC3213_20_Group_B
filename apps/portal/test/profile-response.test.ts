import { describe, expect, test } from 'bun:test';

import { normalizePublicProfileResponse } from '@/components/profiles/profile-types';

describe('public profile response normalization', () => {
  test('preserves a legacy bare profile at the HTTP boundary', () => {
    const profile = { username: 'jdoe', extraField: 'retained' };
    expect(normalizePublicProfileResponse(profile)).toEqual({ profile });
  });

  test('accepts a valid response wrapper and preserves null', () => {
    expect(normalizePublicProfileResponse({ profile: null })).toEqual({
      profile: null,
    });
  });

  test('rejects a malformed response wrapper', () => {
    expect(() => normalizePublicProfileResponse({ profile: [] })).toThrow();
  });
});
