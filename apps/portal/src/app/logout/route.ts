import { NextResponse } from 'next/server';

import publicEnvConfig from '@/config/public.env.config';
import serverEnvConfig from '@/config/server.env.config';

async function logout() {
  const headers = new Headers();
  headers.append(
    'Set-Cookie',
    `session=; HttpOnly; Secure; SameSite=Lax; Domain=${serverEnvConfig.COOKIE_DOMAIN}; Path=/; Max-Age=0`
  );

  headers.append(
    'Set-Cookie',
    `oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
  );
  const redirectUrl = new URL(
    '/login?error=invalid_session',
    publicEnvConfig.NEXT_PUBLIC_SITE_URL
  );
  return NextResponse.redirect(redirectUrl, { headers });
}

export { logout as GET, logout as POST };
