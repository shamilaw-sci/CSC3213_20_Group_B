import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const session =
    request.cookies.get('session') ??
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

  // Not logged in → block protected routes
  if (!session && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Already logged in → block login/signup
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
  ],
};
