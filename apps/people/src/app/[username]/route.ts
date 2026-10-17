import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const url = new URL(request.url);
  url.pathname = `/people/${encodeURIComponent(username)}`;

  return NextResponse.redirect(url, 308);
}

export const HEAD = GET;
