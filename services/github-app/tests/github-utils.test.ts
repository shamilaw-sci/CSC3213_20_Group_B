import { describe, expect, test } from 'bun:test';

import { isGitHubMissingRefError, isGitHubNotFoundError } from '@/utils/github';

describe('github error helpers', () => {
  test('detects missing ref update errors from GitHub', () => {
    expect(
      isGitHubMissingRefError({
        status: 422,
        message:
          'Reference does not exist - https://docs.github.com/rest/git/refs#update-a-reference',
      })
    ).toBe(true);
  });

  test('does not treat unrelated validation failures as missing refs', () => {
    expect(
      isGitHubMissingRefError({
        status: 422,
        message: 'Validation Failed',
      })
    ).toBe(false);
  });

  test('keeps not found detection limited to 404 responses', () => {
    expect(isGitHubNotFoundError({ status: 404 })).toBe(true);
    expect(isGitHubNotFoundError({ status: 422 })).toBe(false);
  });
});
