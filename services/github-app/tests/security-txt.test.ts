import { describe, expect, test } from 'bun:test';

import app from '@/app';
import type { GithubAppEnv } from '@/types/env';

describe('GitHub App security.txt redirect', () => {
  const env = { X_INTERNAL_SECRET: 'test-secret' } as GithubAppEnv;

  test('redirects GET and HEAD before authentication and routes', async () => {
    for (const [method, path] of [
      ['GET', '/security.txt'],
      ['HEAD', '/SECURITY.TXT'],
      ['GET', '/.Well-Known/Security.Txt'],
    ]) {
      const response = await app.request(
        `https://github-app.scs-pdn.space${path}?from=github`,
        { method },
        env
      );

      expect(response.status).toBe(308);
      expect(response.headers.get('location')).toBe(
        'https://portal.scs-pdn.space/.well-known/security.txt'
      );
    }
  });

  test('does not enable unsupported methods', async () => {
    const response = await app.request(
      'https://github-app.scs-pdn.space/security.txt',
      {
        method: 'POST',
      },
      env
    );

    expect(response.status).toBe(401);
  });
});
