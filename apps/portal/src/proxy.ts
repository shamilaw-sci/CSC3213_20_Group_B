import { getSecurityTxtRedirectTarget } from '@scs/security';
import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const securityTxtRedirect = getSecurityTxtRedirectTarget(request);
  if (securityTxtRedirect) {
    return NextResponse.redirect(securityTxtRedirect, 308);
  }

  const session =
    request.cookies.get('scs-auth.session_token') ??
    request.cookies.get('__Secure-scs-auth.session_token');

  const { pathname } = request.nextUrl;

  const isAuthPage =
    pathname.startsWith('/login') || pathname.startsWith('/signup');

  const isProtected =
    pathname.startsWith('/user') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/academic');

  if (!session && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (session && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/login',
    '/signup',
    '/dashboard/:path*',
    '/user/:path*',
    '/admin/:path*',
    '/academic/:path*',
    '/[sS][eE][cC][uU][rR][iI][tT][yY]\\.[tT][xX][tT]',
    '/\\.[wW][eE][lL][lL]-[kK][nN][oO][wW][nN]/[sS][eE][cC][uU][rR][iI][tT][yY]\\.[tT][xX][tT]',
  ],
};
