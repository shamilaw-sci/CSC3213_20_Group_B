import { describe, expect, test } from 'bun:test';

import { hasSessionCookie } from '@/middleware/session';

function requestWithCookie(cookie?: string): Request {
  return new Request('https://api.test.scs-pdn.space/api/me', {
    headers: cookie ? { Cookie: cookie } : undefined,
  });
}

describe('session cookie compatibility', () => {
  test('recognizes the legacy JWT session cookie', () => {
    expect(hasSessionCookie(requestWithCookie('session=legacy-token'))).toBe(
      true
    );
  });

  test('recognizes Better Auth development and secure session cookies', () => {
    expect(
      hasSessionCookie(
        requestWithCookie('scs-auth.session_token=development-token')
      )
    ).toBe(true);
    expect(
      hasSessionCookie(
        requestWithCookie('__Secure-scs-auth.session_token=production-token')
      )
    ).toBe(true);
  });

  test('does not treat cache-only or unrelated cookies as a session', () => {
    expect(
      hasSessionCookie(requestWithCookie('scs-auth.session_data=cache'))
    ).toBe(false);
    expect(hasSessionCookie(requestWithCookie('theme=dark'))).toBe(false);
    expect(hasSessionCookie(requestWithCookie())).toBe(false);
  });
});
