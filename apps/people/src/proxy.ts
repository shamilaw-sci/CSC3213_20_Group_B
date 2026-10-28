import { getSecurityTxtRedirectTarget } from '@scs/security';
import { type NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const securityTxtRedirect = getSecurityTxtRedirectTarget(request);
  if (securityTxtRedirect) {
    return NextResponse.redirect(securityTxtRedirect, 308);
  }

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
    '/[sS][eE][cC][uU][rR][iI][tT][yY]\\.[tT][xX][tT]',
    '/\\.[wW][eE][lL][lL]-[kK][nN][oO][wW][nN]/[sS][eE][cC][uU][rR][iI][tT][yY]\\.[tT][xX][tT]',
    '/((?!api(?:/|$)|_next(?:/|$)|favicon.ico$|robots.txt$|sitemap.xml$|.*\\.[^/]+$).*)',
  ],
};
