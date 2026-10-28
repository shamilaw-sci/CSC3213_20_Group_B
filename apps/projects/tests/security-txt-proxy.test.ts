import { NextRequest } from 'next/server';

import { config, proxy } from '@/proxy';

const canonicalUrl = 'https://portal.scs-pdn.space/.well-known/security.txt';

describe('Projects security.txt redirect', () => {
  test('matches only the two security discovery routes', () => {
    expect(config.matcher).toHaveLength(2);
    expect(config.matcher).not.toContain('/:path*');
  });

  test.each([
    ['GET', '/security.txt'],
    ['HEAD', '/SECURITY.TXT'],
    ['GET', '/.Well-Known/Security.Txt'],
  ])('redirects %s %s permanently', (method, path) => {
    const response = proxy(
      new NextRequest(`https://projects.scs-pdn.space${path}?from=projects`, {
        method,
      })
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(canonicalUrl);
  });

  test('leaves unrelated paths and unsupported methods untouched', () => {
    for (const request of [
      new NextRequest('https://projects.scs-pdn.space/projects/example'),
      new NextRequest('https://projects.scs-pdn.space/security.txt', {
        method: 'POST',
      }),
    ]) {
      expect(proxy(request).headers.get('x-middleware-next')).toBe('1');
    }
  });
});
