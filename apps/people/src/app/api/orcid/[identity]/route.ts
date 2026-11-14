import { NextResponse } from 'next/server';
import { z } from 'zod';

import publicEnvConfig from '@/config/public.env.config';

const PublicOrcidSchema = z.object({ orcid: z.string().nullable() });

export async function GET(
  _request: Request,
  context: { params: Promise<{ identity: string }> }
) {
  const { identity } = await context.params;
  if (!/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(identity))
    return NextResponse.json({ orcid: null }, { status: 400 });
  try {
    const endpoint = new URL(
      `/api/orcid/public/${encodeURIComponent(identity)}`,
      publicEnvConfig.NEXT_PUBLIC_API_BASE_URL
    );
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(5_000),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('ORCID lookup failed');
    const parsed = PublicOrcidSchema.parse(await response.json());
    return NextResponse.json(parsed, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json(
      { orcid: null },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
