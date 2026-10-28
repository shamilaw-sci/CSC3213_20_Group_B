import { describe, expect, test } from 'bun:test';
import { NextRequest } from 'next/server';

import { config, proxy } from '@/proxy';

const canonicalUrl = 'https://portal.scs-pdn.space/.well-known/security.txt';

describe('People security.txt redirect', () => {
  test('does not run the proxy for every request', () => {
    expect(config.matcher).not.toContain('/:path*');
  });

  test('redirects discovery paths case-insensitively for GET and HEAD', () => {
    for (const [method, path] of [
      ['GET', '/security.txt'],
      ['HEAD', '/SECURITY.TXT'],
      ['GET', '/.Well-Known/Security.Txt'],
    ]) {
      const response = proxy(
        new NextRequest(`https://people.scs-pdn.space${path}?from=people`, {
          method,
        })
      );

      expect(response.status).toBe(308);
      expect(response.headers.get('location')).toBe(canonicalUrl);
    }
  });

  test('leaves unrelated paths and unsupported methods untouched', () => {
    expect(
      proxy(
        new NextRequest('https://people.scs-pdn.space/students')
      ).headers.get('x-middleware-next')
    ).toBe('1');
    expect(
      proxy(
        new NextRequest('https://people.scs-pdn.space/security.txt', {
          method: 'POST',
        })
      ).headers.get('x-middleware-next')
    ).toBe('1');
  });
});
