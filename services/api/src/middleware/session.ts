import { createAuth } from '@/auth/auth';
import { ALLOWED_CLIENTS } from '@/config/client.config';
import type { Env } from '@/types/env';
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

type SessionPayload = {
  sub?: string;
  email: string;
  name?: string;
  picture?: string;
  role: string;
  accessLevel: string;
  aud?: string;
  exp?: number;
};

type SessionIdentity = Omit<SessionPayload, 'role' | 'accessLevel'> & {
  role?: unknown;
  accessLevel?: unknown;
};

const BETTER_AUTH_SESSION_COOKIE_NAMES = [
  'scs-auth.session_token',
  '__Secure-scs-auth.session_token',
] as const;

export function hasSessionCookie(req: Request): boolean {
  const cookies = parseCookies(req.headers.get('Cookie'));
  return BETTER_AUTH_SESSION_COOKIE_NAMES.some(
    (cookieName) => typeof cookies[cookieName] === 'string'
  );
}

export async function verifyIdentitySession(
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
      exp: Math.floor(new Date(authSession.session.expiresAt).getTime() / 1000),
    };
  } catch (error: unknown) {
    console.error('Better Auth session verification failed:', error);
    return createTextErrorResponse('Invalid token', 401, origin);
  }
}

async function verifySession(
  req: Request,
  env: Env,
  clientId: string
): Promise<SessionPayload | Response> {
  const payload = await verifyIdentitySession(req, env, clientId);
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

export async function verifySessionRequest(
  req: Request,
  env: Env
): Promise<Response> {
  const clientId = requireAllowedClientId(req, ALLOWED_CLIENTS);
  if (clientId instanceof Response) return clientId;

  const payload = await verifySession(req, env, clientId);
  if (payload instanceof Response) return payload;

  return Response.json({
    valid: true,
    email: payload.email,
    role: payload.role,
    accessLevel: payload.accessLevel,
  });
}

function requireAllowedClientId(
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
