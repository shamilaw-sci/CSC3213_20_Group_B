import { describe, expect, test } from 'bun:test';

import {
  handleSubmitPublicProfileOperation,
  handleUpsertPublicProfilePr,
} from '@/controllers/public-profile.controller';
import type { GithubAppEnv } from '@/types/env';

describe('public profile image migration', () => {
  const legacy = {
    profile: { profileImageUrl: 'https://example.com/old.jpg' },
  };

  test('rejects legacy fields on direct internal PR requests', async () => {
    const response = await handleUpsertPublicProfilePr(
      new Request('https://gh.example/people/public-profile/pr', {
        method: 'POST',
        body: JSON.stringify(legacy),
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(response.status).toBe(400);
  });

  test('rejects legacy fields on queued operations', async () => {
    const response = await handleSubmitPublicProfileOperation(
      new Request('https://gh.example/people/public-profile/operations', {
        method: 'POST',
        body: JSON.stringify({ request: legacy }),
        headers: { 'Content-Type': 'application/json' },
      }),
      {} as GithubAppEnv
    );
    expect(response.status).toBe(400);
  });
});
