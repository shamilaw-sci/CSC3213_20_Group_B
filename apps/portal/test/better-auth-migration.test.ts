import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function source(path: string): string {
  return readFileSync(resolve(import.meta.dir, '..', path), 'utf8');
}

describe('Portal Better Auth integration', () => {
  test('uses the API Better Auth base path with OTP and passkey plugins', () => {
    const client = source('src/lib/auth-client.ts');

    expect(client).toContain("basePath: '/api/auth'");
    expect(client).toContain('emailOTPClient()');
    expect(client).toContain('passkeyClient()');
    expect(client).toContain("credentials: 'include'");
  });

  test('moves Google, email OTP, passkeys, and logout to Better Auth', () => {
    const login = source('src/components/custom/login-form/login-form.tsx');
    const magicCode = source(
      'src/components/custom/magic-code-form/magic-code-form.tsx'
    );
    const passkeys = source('src/lib/passkeys.ts');
    const logout = source(
      'src/components/custom/logout-button/logout-button.tsx'
    );

    expect(login).toContain('authClient.signIn.social');
    expect(magicCode).toContain('authClient.emailOtp.sendVerificationOtp');
    expect(magicCode).toContain('authClient.signIn.emailOtp');
    expect(passkeys).toContain('authClient.signIn.passkey');
    expect(passkeys).toContain('authClient.passkey.addPasskey');
    expect(logout).toContain('authClient.signOut');
  });

  test('recognizes Better Auth session cookies in route protection', () => {
    const proxy = source('src/proxy.ts');

    expect(proxy).toContain("request.cookies.get('scs-auth.session_token')");
    expect(proxy).toContain(
      "request.cookies.get('__Secure-scs-auth.session_token')"
    );
  });
});
