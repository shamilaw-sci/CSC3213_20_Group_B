import { normalizeOrcidIdentifier } from '@scs/schemas';
import { z } from 'zod';

import { createAuth } from '@/auth/auth';
import { ALLOWED_ORIGINS } from '@/config/client.config';
import {
  createJsonErrorResponse,
  createJsonResponse,
  getRequestOrigin,
} from '@/http/responses';
import { getUserPermission } from '@/repositories/permissions.repo';
import { orcidRepository } from '@/repositories/orcid.repo';
import type { Env } from '@/types/env';
import { isAllowedEmailDomain } from '@/utils/email-domains';

const TokenResponseSchema = z.object({
  orcid: z.string(),
  scope: z.string(),
  token_type: z.string(),
  access_token: z.string(),
});
const STATE_LIFETIME_MS = 10 * 60 * 1000;

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

async function portalSession(req: Request, env: Env) {
  const session = await createAuth(req, env).api.getSession({
    headers: req.headers,
  });
  if (!session?.user.emailVerified || !isAllowedEmailDomain(session.user.email))
    return null;
  const permission = await getUserPermission(
    session.user.email.toLowerCase(),
    env
  );
  if (!permission || permission.blacklisted) return null;
  return session;
}

function callbackUrl(env: Env): string {
  return new URL('/api/orcid/callback', env.BETTER_AUTH_URL).toString();
}

function configured(env: Env): boolean {
  return Boolean(env.ORCID_CLIENT_ID && env.ORCID_CLIENT_SECRET);
}

function allowedPortalOrigin(req: Request, env: Env): string | null {
  const origin = getRequestOrigin(req);
  return (env.ALLOWED_ORIGINS ?? ALLOWED_ORIGINS).includes(origin)
    ? origin
    : null;
}

export async function startOrcidConnection(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = allowedPortalOrigin(req, env);
  if (!origin) return createJsonErrorResponse('Forbidden origin', 403, '');
  if (!configured(env))
    return createJsonErrorResponse(
      'ORCID connection is not configured',
      503,
      origin
    );
  const session = await portalSession(req, env);
  if (!session)
    return createJsonErrorResponse(
      'Sign in with a verified university account first',
      401,
      origin
    );
  const state = crypto.randomUUID() + crypto.randomUUID();
  await orcidRepository(env).saveIntent({
    userId: session.user.id,
    stateHash: await sha256(state),
    sessionId: session.session.id,
    portalOrigin: origin,
    expiresAt: Date.now() + STATE_LIFETIME_MS,
  });
  const authorization = new URL('https://orcid.org/oauth/authorize');
  authorization.searchParams.set('client_id', env.ORCID_CLIENT_ID!);
  authorization.searchParams.set('response_type', 'code');
  authorization.searchParams.set('scope', '/authenticate');
  authorization.searchParams.set('redirect_uri', callbackUrl(env));
  authorization.searchParams.set('state', state);
  return createJsonResponse({ url: authorization.toString() }, 200, origin);
}

export async function completeOrcidConnection(
  req: Request,
  env: Env
): Promise<Response> {
  const params = new URL(req.url).searchParams;
  const state = params.get('state');
  if (!state || !/^[0-9a-f-]{72}$/.test(state))
    return new Response('Invalid OAuth state', { status: 400 });
  const repository = orcidRepository(env);
  const intent = await repository.getIntent(await sha256(state));
  if (!intent || intent.expiresAt <= Date.now())
    return new Response('Expired OAuth state', { status: 400 });
  const finishUrl = new URL('/account/settings', intent.portalOrigin);
  const fail = () => {
    finishUrl.searchParams.set('orcid', 'failed');
    return Response.redirect(finishUrl, 303);
  };
  if (params.has('error') || !params.get('code') || !configured(env))
    return fail();
  const session = await portalSession(req, env);
  if (
    !session ||
    session.user.id !== intent.userId ||
    session.session.id !== intent.sessionId
  )
    return fail();
  let tokenResponse: Response;
  try {
    tokenResponse = await fetch('https://orcid.org/oauth/token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: env.ORCID_CLIENT_ID!,
        client_secret: env.ORCID_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code: params.get('code')!,
        redirect_uri: callbackUrl(env),
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return fail();
  }
  if (!tokenResponse.ok) return fail();
  const tokens = TokenResponseSchema.safeParse(
    await tokenResponse.json().catch(() => null)
  );
  if (
    !tokens.success ||
    tokens.data.token_type.toLowerCase() !== 'bearer' ||
    !tokens.data.scope.split(' ').includes('/authenticate')
  )
    return fail();
  const identifier = normalizeOrcidIdentifier(tokens.data.orcid);
  if (!identifier) return fail();
  try {
    if (!(await repository.connect(intent, identifier))) return fail();
  } catch {
    return fail();
  }
  finishUrl.searchParams.set('orcid', 'connected');
  return Response.redirect(finishUrl, 303);
}

export async function getMyOrcid(req: Request, env: Env): Promise<Response> {
  const origin = allowedPortalOrigin(req, env);
  if (!origin) return createJsonErrorResponse('Forbidden origin', 403, '');
  const session = await portalSession(req, env);
  if (!session) return createJsonErrorResponse('Unauthorized', 401, origin);
  return createJsonResponse(
    {
      orcid: normalizeOrcidIdentifier(
        (await orcidRepository(env).getForUser(session.user.id)) ?? ''
      ),
    },
    200,
    origin
  );
}

export async function disconnectOrcid(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = allowedPortalOrigin(req, env);
  if (!origin) return createJsonErrorResponse('Forbidden origin', 403, '');
  const session = await portalSession(req, env);
  if (!session) return createJsonErrorResponse('Unauthorized', 401, origin);
  await orcidRepository(env).disconnect(session.user.id);
  return createJsonResponse({ orcid: null }, 200, origin);
}

export async function getPublicOrcid(
  req: Request,
  env: Env
): Promise<Response> {
  const username = new URL(req.url).pathname.split('/').at(-1)?.toLowerCase();
  if (!username || !/^[a-z0-9][a-z0-9._-]{0,99}$/.test(username))
    return Response.json({ orcid: null }, { status: 400 });
  const identifier = normalizeOrcidIdentifier(
    (await orcidRepository(env).getForUsername(username)) ?? ''
  );
  return Response.json(
    { orcid: identifier },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
