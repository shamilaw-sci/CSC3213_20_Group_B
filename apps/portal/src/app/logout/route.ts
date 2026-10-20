import { NextResponse } from 'next/server';

import publicEnvConfig from '@/config/public.env.config';
import serverEnvConfig from '@/config/server.env.config';

const AUTH_COOKIE_NAMES = [
  'scs-auth.session_token',
  '__Secure-scs-auth.session_token',
  'scs-auth.session_data',
  '__Secure-scs-auth.session_data',
] as const;

async function logout() {
  const headers = new Headers();
  const secure = publicEnvConfig.NEXT_PUBLIC_SITE_URL.startsWith('https://')
    ? '; Secure'
    : '';
  for (const cookieName of AUTH_COOKIE_NAMES) {
    headers.append(
      'Set-Cookie',
      `${cookieName}=; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=0`
    );
    headers.append(
      'Set-Cookie',
      `${cookieName}=; HttpOnly${secure}; SameSite=Lax; Domain=${serverEnvConfig.COOKIE_DOMAIN}; Path=/; Max-Age=0`
    );
  }
  const redirectUrl = new URL(
    '/login?error=invalid_session',
    publicEnvConfig.NEXT_PUBLIC_SITE_URL
  );
  return NextResponse.redirect(redirectUrl, { headers });
}

export { logout as GET, logout as POST };
