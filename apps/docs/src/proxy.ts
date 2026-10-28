import { getSecurityTxtRedirectTarget } from '@scs/security';
import { type NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const securityTxtRedirect = getSecurityTxtRedirectTarget(request);
  if (securityTxtRedirect) {
    return NextResponse.redirect(securityTxtRedirect, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/([sS][eE][cC][uU][rR][iI][tT][yY]\\.[tT][xX][tT])',
    '/(\\.[wW][eE][lL][lL]-[kK][nN][oO][wW][nN]/[sS][eE][cC][uU][rR][iI][tT][yY]\\.[tT][xX][tT])',
  ],
};
