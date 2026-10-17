import { NextResponse } from 'next/server';

import serverEnvConfig from '@/config/server.env.config';

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
  return NextResponse.redirect(serverEnvConfig.MOODLE_URL, 308);
}
