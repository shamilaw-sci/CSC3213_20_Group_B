import { jwtVerify } from 'jose';

import type { Env } from '@/types/env';
import { isTokenRevoked } from '@/repositories/token-blacklist.repo';
import {
  ACCESS_LEVEL,
  normalizeAccessLevel,
  normalizeAppRole,
} from '@/repositories/permissions.repo';
import { parseCookies } from '@/utils/cookies';
import { createTextErrorResponse } from '@/http/responses';

export type SessionPayload = {
  sub?: string;
  email: string;
  name?: string;
  picture?: string;
  role: string;
  accessLevel: string;
  jti?: string;
  aud?: string;
  exp?: number;
};

export async function verifySessionToken(
  req: Request,
  env: Env,
  clientId: string
): Promise<SessionPayload | Response> {
  const session = parseCookies(req.headers.get('Cookie')).session;
  if (!session) {
    return createTextErrorResponse(
      'Missing token',
      401,
      req.headers.get('origin') || ''
    );
  }

  try {
    const { payload } = await jwtVerify(
      session,
      new TextEncoder().encode(env.JWT_SECRET),
      {
        issuer: env.JWT_ISSUER,
        audience: clientId,
      }
    );

    const jti = payload.jti;
    if (typeof jti === 'string' && (await isTokenRevoked(jti, env))) {
      return createTextErrorResponse(
        'Token revoked',
        401,
        req.headers.get('origin') || ''
      );
    }

    if (typeof payload.email !== 'string') {
      return createTextErrorResponse(
        'Invalid token',
        401,
        req.headers.get('origin') || ''
      );
    }

    const role = normalizeAppRole(payload.role);
    if (!role) {
      return createTextErrorResponse(
        'Invalid token',
        401,
        req.headers.get('origin') || ''
      );
    }

    return {
      sub: typeof payload.sub === 'string' ? payload.sub : undefined,
      email: payload.email,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      picture:
        typeof payload.picture === 'string' ? payload.picture : undefined,
      role,
      accessLevel:
        normalizeAccessLevel(payload.accessLevel) ?? ACCESS_LEVEL.NONE,
      jti: typeof payload.jti === 'string' ? payload.jti : undefined,
      aud: typeof payload.aud === 'string' ? payload.aud : undefined,
      exp: typeof payload.exp === 'number' ? payload.exp : undefined,
    };
  } catch {
    return createTextErrorResponse(
      'Invalid token',
      401,
      req.headers.get('origin') || ''
    );
  }
}

export function requireAllowedClientId(
  req: Request,
  allowed: Record<string, boolean>
): string | Response {
  const clientId = req.headers.get('X-Client-Id');
  if (!clientId) return new Response('Missing client context', { status: 400 });
  if (!allowed[clientId]) {
    return new Response('Unauthorized client_id', { status: 403 });
  }
  return clientId;
}
