import { NextResponse } from 'next/server';

import publicEnvConfig from '@/config/public.env.config';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function GET() {
  return NextResponse.redirect(publicEnvConfig.NEXT_PUBLIC_MOODLE_URL, 308);
}
