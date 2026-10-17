import { type NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const canonicalPathname = pathname.toLowerCase();

  if (pathname === canonicalPathname) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = canonicalPathname;

  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: [
    '/((?!api(?:/|$)|_next(?:/|$)|favicon.ico$|robots.txt$|sitemap.xml$|.*\\.[^/]+$).*)',
  ],
};
