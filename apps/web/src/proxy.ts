import {
  ProxyResolutionResponseSchema,
  ProxyUsernameSchema,
} from '@scs/schemas';
import { getSecurityTxtRedirectTarget } from '@scs/security';
import { NextRequest, NextResponse } from 'next/server';

import serverEnvConfig from '@/config/server.env.config';

const PROXY_LOOKUP_TIMEOUT_MS = 3000;

function personalSiteUrl(
  baseUrl: string,
  restPath: string,
  search: string
): URL {
  const destination = new URL(baseUrl);
  if (restPath !== '') {
    const basePath = destination.pathname.endsWith('/')
      ? destination.pathname
      : `${destination.pathname}/`;
    destination.pathname = `${basePath}${restPath.slice(1)}`;
  }
  destination.search = search;
  destination.hash = '';
  return destination;
}

function noStoreResponse(status: 404 | 502): Response {
  return new Response(null, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function temporaryRedirect(destination: URL): NextResponse {
  const response = NextResponse.redirect(destination, 307);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export default async function proxy(req: NextRequest) {
  const securityTxtRedirect = getSecurityTxtRedirectTarget(req);
  if (securityTxtRedirect) {
    return NextResponse.redirect(securityTxtRedirect, 308);
  }

  // eslint-disable-next-line no-console
  console.log('[scs.pdn.ac.lk]:PROXY HIT:', req.nextUrl.pathname);
  const pathname = req.nextUrl.pathname;
  if (pathname.toLowerCase().endsWith('.php')) {
    const redirectPathname = pathname.slice(0, -4);
    return NextResponse.redirect(new URL(redirectPathname, req.url));
  }

  if (pathname.startsWith('/~')) {
    const usernameSegment = pathname.slice(2).split('/')[0];
    if (!usernameSegment) return NextResponse.next();

    const username = ProxyUsernameSchema.safeParse(usernameSegment);
    if (!username.success) {
      console.warn(`Invalid username attempted: ${usernameSegment}`);
      return new Response('Invalid username', { status: 400 });
    }

    const resolverUrl = new URL(
      `/api/internal/proxies/${encodeURIComponent(username.data)}`,
      serverEnvConfig.PROXY_API_URL
    );
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), PROXY_LOOKUP_TIMEOUT_MS);
      const response = await fetch(resolverUrl, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'X-Internal-Secret': serverEnvConfig.WEB_PROXY_INTERNAL_SECRET,
        },
        signal: controller.signal,
      });
      if (response.status === 404) {
        return noStoreResponse(404);
      }
      if (!response.ok) {
        throw new Error(`Proxy resolver returned ${response.status}`);
      }

      const proxyDetails = ProxyResolutionResponseSchema.safeParse(
        await response.json()
      );
      if (!proxyDetails.success) {
        throw new Error('Proxy resolver returned an invalid response');
      }

      const restPath = pathname.substring(2 + usernameSegment.length);
      return temporaryRedirect(
        personalSiteUrl(proxyDetails.data.url, restPath, req.nextUrl.search)
      );
    } catch (err) {
      console.error('Proxy API request failed:', err);
      return noStoreResponse(502);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  return NextResponse.next();
}
