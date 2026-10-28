// @vitest-environment node

import { NextRequest } from 'next/server';

import proxy from '@/proxy';

const canonicalUrl = 'https://portal.scs-pdn.space/.well-known/security.txt';

describe('Web security.txt redirect', () => {
  test.each([
    ['GET', '/security.txt'],
    ['HEAD', '/SECURITY.TXT'],
    ['GET', '/.Well-Known/Security.Txt'],
  ])('redirects %s %s permanently', async (method, path) => {
    const response = await proxy(
      new NextRequest(`https://scs-pdn.space${path}?from=web`, { method })
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(canonicalUrl);
  });

  test('leaves unrelated paths and unsupported methods untouched', async () => {
    for (const request of [
      new NextRequest('https://scs-pdn.space/about-us'),
      new NextRequest('https://scs-pdn.space/security.txt', { method: 'POST' }),
    ]) {
      const response = await proxy(request);
      expect(response.headers.get('x-middleware-next')).toBe('1');
    }
  });
});
