import { jwtVerify } from 'jose';

import { createAuth } from '@/auth/auth';
import type { Env } from '@/types/env';
import { isTokenRevoked } from '@/repositories/token-blacklist.repo';
import {
  ACCESS_LEVEL,
  getPermissionAccessLevel,
  getPermissionRole,
  getUserPermission,
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

export type SessionIdentity = Omit<SessionPayload, 'role' | 'accessLevel'> & {
  role?: unknown;
  accessLevel?: unknown;
};

const BETTER_AUTH_SESSION_COOKIE_NAMES = [
  'scs-auth.session_token',
  '__Secure-scs-auth.session_token',
] as const;

export function hasSessionCookie(req: Request): boolean {
  const cookies = parseCookies(req.headers.get('Cookie'));
  return (
    typeof cookies.session === 'string' ||
    BETTER_AUTH_SESSION_COOKIE_NAMES.some(
      (cookieName) => typeof cookies[cookieName] === 'string'
    )
  );
}

async function verifyBetterAuthSession(
  req: Request,
  env: Env,
  clientId: string
): Promise<SessionIdentity | Response> {
  const origin = req.headers.get('origin') || '';

  try {
    const authSession = await createAuth(req, env).api.getSession({
      headers: req.headers,
    });
    if (!authSession?.user.email) {
      return createTextErrorResponse('Invalid token', 401, origin);
    }

    const email = authSession.user.email.toLowerCase();
    const permission = await getUserPermission(email, env);
    if (!permission) {
      return createTextErrorResponse('User not found', 404, origin);
    }
    if (permission.blacklisted) {
      return createTextErrorResponse('Forbidden', 403, origin);
    }

    return {
      sub: authSession.user.id,
      email,
      name: permission.name ?? authSession.user.name,
      picture: permission.picture ?? authSession.user.image ?? undefined,
      role: getPermissionRole(permission),
      accessLevel: getPermissionAccessLevel(permission),
      aud: clientId,
      exp: Math.floor(authSession.session.expiresAt.getTime() / 1000),
    };
  } catch (error: unknown) {
    console.error('Better Auth session verification failed:', error);
    return createTextErrorResponse('Invalid token', 401, origin);
  }
}

export async function verifyIdentitySessionToken(
  req: Request,
  env: Env,
  clientId: string
): Promise<SessionIdentity | Response> {
  const cookies = parseCookies(req.headers.get('Cookie'));
  const session = cookies.session;
  if (!session) {
    const hasBetterAuthCookie = BETTER_AUTH_SESSION_COOKIE_NAMES.some(
      (cookieName) => typeof cookies[cookieName] === 'string'
    );
    if (hasBetterAuthCookie) {
      return verifyBetterAuthSession(req, env, clientId);
    }

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

    return {
      sub: typeof payload.sub === 'string' ? payload.sub : undefined,
      email: payload.email,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      picture:
        typeof payload.picture === 'string' ? payload.picture : undefined,
      role: payload.role,
      accessLevel: payload.accessLevel,
      jti: typeof payload.jti === 'string' ? payload.jti : undefined,
      aud: typeof payload.aud === 'string' ? payload.aud : undefined,
      exp: typeof payload.exp === 'number' ? payload.exp : undefined,
    };
  } catch (error: unknown) {
    console.error('JWT verification failed:', error);
    return createTextErrorResponse(
      'Invalid token',
      401,
      req.headers.get('origin') || ''
    );
  }
}

export async function verifySessionToken(
  req: Request,
  env: Env,
  clientId: string
): Promise<SessionPayload | Response> {
  const payload = await verifyIdentitySessionToken(req, env, clientId);
  if (payload instanceof Response) return payload;

  const role = normalizeAppRole(payload.role);
  if (!role) {
    return createTextErrorResponse(
      'Invalid token',
      401,
      req.headers.get('origin') || ''
    );
  }

  return {
    ...payload,
    role,
    accessLevel: normalizeAccessLevel(payload.accessLevel) ?? ACCESS_LEVEL.NONE,
  };
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
