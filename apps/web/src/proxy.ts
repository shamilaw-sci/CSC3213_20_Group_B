import { NextRequest, NextResponse } from 'next/server';

import serverEnvConfig from '@/config/server.env.config';

export default async function proxy(req: NextRequest) {
  // eslint-disable-next-line no-console
  console.log('[scs.pdn.ac.lk]:PROXY HIT:', req.nextUrl.pathname);
  const pathname = req.nextUrl.pathname.replace(/\/$/, '').toLowerCase();
  if (pathname.endsWith('.php')) {
    const redirectPathname = pathname.slice(0, -4);
    return NextResponse.redirect(new URL(redirectPathname, req.url));
  }

  if (pathname.startsWith('/~')) {
    const username = pathname.slice(2).split('/')[0].toLowerCase();
    const USERNAME_REGEX = /^[a-z0-9_-]+$/;
    if (!USERNAME_REGEX.test(username)) {
      console.warn(`Invalid username attempted: ${username}`);
      return new Response('Invalid username', { status: 400 });
    }
    if (!username) {
      return NextResponse.next();
    }
    const workerUrl = new URL(username, serverEnvConfig.WORKER_URL).toString();
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 3000);
      const response = await fetch(workerUrl, {
        method: 'GET',
        headers: {
          'X-Internal-Secret': serverEnvConfig.CF_SECRET,
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        return NextResponse.rewrite(new URL('/404', req.url));
      }
      const proxyDetails: { active: boolean; proxyUrl: string } =
        await response.json();
      if (!proxyDetails.active) {
        return NextResponse.rewrite(new URL('/404', req.url));
      }
      const restPath = pathname.substring(2 + username.length);
      const proxyUrl = new URL(restPath, proxyDetails.proxyUrl);
      return NextResponse.rewrite(proxyUrl);
    } catch (err) {
      console.error('Worker fetch failed:', err);
      return NextResponse.rewrite(new URL('/500', req.url));
    }
  }

  return NextResponse.next();
}
