import { describe, expect, test } from 'bun:test';
import { NextRequest } from 'next/server';

import { GET } from '@/app/.well-known/security.txt/route';
import { config, proxy } from '@/proxy';

const canonicalUrl = 'https://portal.scs-pdn.space/.well-known/security.txt';

describe('Portal security.txt', () => {
  test('limits proxy matching to security discovery and existing auth areas', () => {
    expect(config.matcher).not.toContain('/:path*');
    expect(config.matcher).toHaveLength(8);
  });

  test('serves the canonical RFC 9116 document', async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(
      'text/plain; charset=utf-8'
    );
    expect(await response.text()).toBe(
      [
        'Contact: mailto:s21513@sci.pdn.ac.lk',
        'Expires: 2027-04-28T00:00:00Z',
        `Canonical: ${canonicalUrl}`,
        'Policy: https://portal.scs-pdn.space/privacy#security-reporting',
        'Preferred-Languages: en',
        '',
      ].join('\n')
    );
  });

  test('exports only GET so Next.js supplies HEAD and rejects other methods', async () => {
    const route = await import('@/app/.well-known/security.txt/route');

    expect(Object.keys(route)).toEqual(['GET']);
  });

  test('redirects legacy and capitalized discovery requests permanently', () => {
    for (const [method, path] of [
      ['GET', '/security.txt'],
      ['HEAD', '/SECURITY.TXT'],
      ['GET', '/.WELL-KNOWN/SECURITY.TXT'],
      ['HEAD', '/.Well-Known/Security.Txt'],
    ]) {
      const response = proxy(
        new NextRequest(`https://portal.scs-pdn.space${path}?source=test`, {
          method,
        })
      );

      expect(response.status, `${method} ${path}`).toBe(308);
      expect(response.headers.get('location'), `${method} ${path}`).toBe(
        canonicalUrl
      );
    }
  });

  test('avoids a canonical-host loop and leaves unsupported methods alone', () => {
    const canonical = proxy(new NextRequest(canonicalUrl));
    const post = proxy(
      new NextRequest('https://portal.scs-pdn.space/security.txt', {
        method: 'POST',
      })
    );

    expect(canonical.headers.get('x-middleware-next')).toBe('1');
    expect(post.headers.get('x-middleware-next')).toBe('1');
  });
});
