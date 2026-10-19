import { describe, expect, test } from 'bun:test';

import { classifyGithubError } from '@/github/github.errors';

describe('GitHub provider error classification', () => {
  test('distinguishes missing refs and compare conflicts from validation', () => {
    expect(
      classifyGithubError({
        status: 422,
        message: 'Reference does not exist',
      }).category
    ).toBe('missing_ref');
    expect(
      classifyGithubError({
        status: 422,
        message: 'Update is not a fast forward',
      }).category
    ).toBe('compare_conflict');
    expect(
      classifyGithubError({ status: 422, message: 'Validation Failed' })
        .category
    ).toBe('validation');
  });

  test('provides executor-safe retry metadata for rate limits and servers', () => {
    expect(
      classifyGithubError({
        status: 403,
        message: 'API rate limit exceeded',
        response: { headers: { 'x-ratelimit-remaining': '0' } },
      })
    ).toMatchObject({ category: 'primary_rate_limit', retryable: true });
    expect(
      classifyGithubError({
        status: 429,
        message: 'You have exceeded a secondary rate limit',
        response: { headers: { 'retry-after': '2' } },
      })
    ).toMatchObject({
      category: 'secondary_rate_limit',
      retryable: true,
      retryAfterMs: 2000,
    });
    expect(classifyGithubError({ status: 503 })).toMatchObject({
      category: 'transient_server',
      retryable: true,
    });
  });
});
