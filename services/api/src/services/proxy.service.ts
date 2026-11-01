import {
  ProxyResolutionResponseSchema,
  ProxyUpdateRequestSchema,
  ProxyUsernameSchema,
  type ProxyUpdateRequest,
} from '@scs/schemas';

import {
  createCorsHeaders,
  createJsonErrorResponse,
  createJsonResponse,
  createNotFoundResponse,
  createTextErrorResponse,
  getRequestOrigin,
} from '@/http/responses';
import { hasSessionCookie, verifyIdentitySession } from '@/middleware/session';
import {
  decodePaginationCursor,
  encodePaginationCursor,
  InvalidPaginationCursorError,
  parsePaginationRequest,
} from '@/pagination/cursor';
import {
  getUserPermission,
  isSuperAdmin,
  isUserRole,
  type Permission,
} from '@/repositories/permissions.repo';
import {
  getActiveProxyByUsername,
  getProxySettings,
  listProxySettingsPage,
  resetProxyAttempts,
  saveProxySettings,
} from '@/repositories/proxy-settings.repo';
import type { Env } from '@/types/env';

interface ProxySession {
  email: string;
  permission: Permission;
}

const INTERNAL_PROXY_PATH_PREFIX = '/api/internal/proxies/';

async function secureSecretEqual(
  actual: string,
  expected: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const [actualDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(actual)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const actualBytes = new Uint8Array(actualDigest);
  const expectedBytes = new Uint8Array(expectedDigest);
  let difference = 0;
  for (let index = 0; index < actualBytes.length; index += 1) {
    difference |= (actualBytes[index] ?? 0) ^ (expectedBytes[index] ?? 0);
  }
  return difference === 0;
}

export async function resolveInternalProxy(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const suppliedSecret = req.headers.get('X-Internal-Secret') ?? '';
  if (
    !(await secureSecretEqual(suppliedSecret, env.WEB_PROXY_INTERNAL_SECRET))
  ) {
    return createJsonErrorResponse('Unauthorized', 401, origin);
  }

  const encodedUsername = new URL(req.url).pathname.slice(
    INTERNAL_PROXY_PATH_PREFIX.length
  );
  let decodedUsername: string;
  try {
    decodedUsername = decodeURIComponent(encodedUsername);
  } catch {
    return createJsonErrorResponse('Invalid proxy username', 400, origin);
  }

  const username = ProxyUsernameSchema.safeParse(decodedUsername);
  if (!username.success) {
    return createJsonErrorResponse('Invalid proxy username', 400, origin);
  }

  const resolution = await getActiveProxyByUsername(env, username.data);
  if (!resolution) return createNotFoundResponse(origin);

  const validated = ProxyResolutionResponseSchema.safeParse(resolution);
  if (!validated.success) {
    console.error('Stored proxy destination failed validation', {
      username: username.data,
    });
    return createNotFoundResponse(origin);
  }

  const response = createJsonResponse(validated.data, 200, origin);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

async function requireProxySession(
  req: Request,
  env: Env
): Promise<ProxySession | Response> {
  const origin = getRequestOrigin(req);
  if (!hasSessionCookie(req)) {
    return createTextErrorResponse('Unauthorized', 401, origin);
  }
  const clientId = req.headers.get('X-Client-Id');
  if (!clientId) {
    return createTextErrorResponse('Missing X-Client-Id header', 400, origin);
  }
  const payload = await verifyIdentitySession(req, env, clientId);
  if (payload instanceof Response) return payload;

  const permission = await getUserPermission(payload.email, env);
  if (!permission) {
    return createTextErrorResponse('User not found', 404, origin);
  }
  if (permission.blacklisted || isUserRole(permission)) {
    return createTextErrorResponse('Forbidden', 403, origin);
  }
  return { email: payload.email.toLowerCase(), permission };
}

async function requireAdminProxySession(
  req: Request,
  env: Env
): Promise<ProxySession | Response> {
  const session = await requireProxySession(req, env);
  if (session instanceof Response) return session;
  if (!isSuperAdmin(session.permission)) {
    return createTextErrorResponse('Forbidden', 403, getRequestOrigin(req));
  }
  return session;
}

function parseTargetEmail(input: {
  actorEmail: string;
  actorIsAdmin: boolean;
  requestedEmail?: string;
  action: 'edit' | 'view';
  origin: string;
}): { ok: true; email: string } | { ok: false; response: Response } {
  const requestedEmail = input.requestedEmail?.trim().toLowerCase();
  if (!requestedEmail || requestedEmail === input.actorEmail) {
    return { ok: true, email: input.actorEmail };
  }
  if (!input.actorIsAdmin) {
    const verb = input.action === 'view' ? 'view' : 'edit';
    return {
      ok: false,
      response: createTextErrorResponse(
        `Forbidden: only admin can ${verb} other user's proxy`,
        403,
        input.origin
      ),
    };
  }
  return { ok: true, email: requestedEmail };
}

function parseProxyBodyError(
  body: ReturnType<typeof ProxyUpdateRequestSchema.safeParse>,
  origin: string
): Response | null {
  if (body.success) return null;
  const issue = body.error.issues[0];
  const field = typeof issue.path[0] === 'string' ? issue.path[0] : undefined;
  return createJsonResponse(
    field === 'url'
      ? {
          code: 'invalid_proxy_url',
          message: 'Enter a valid HTTPS proxy URL.',
          field,
        }
      : {
          code: 'invalid_proxy_update',
          message: issue.message,
          ...(field ? { field } : {}),
        },
    400,
    origin
  );
}

function attemptsExhaustedResponse(origin: string): Response {
  return new Response(
    JSON.stringify({
      code: 'proxy_attempts_exhausted',
      message: 'You have used all your editing attempts for today.',
    }),
    { status: 409, headers: createCorsHeaders(origin) }
  );
}

async function readUpdateBody(
  req: Request
): Promise<ProxyUpdateRequest | Response> {
  const origin = getRequestOrigin(req);
  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch (error) {
    console.error('Failed to parse JSON body:', error);
    return createTextErrorResponse('Invalid JSON body', 400, origin);
  }
  const validatedBody = ProxyUpdateRequestSchema.safeParse(parsed);
  const errorResponse = parseProxyBodyError(validatedBody, origin);
  if (errorResponse) return errorResponse;
  if (!validatedBody.success) {
    return createJsonErrorResponse('Invalid proxy update', 400, origin);
  }
  return validatedBody.data;
}

async function requireEligibleTarget(
  email: string,
  env: Env,
  origin: string
): Promise<Response | null> {
  const permission = await getUserPermission(email, env);
  if (!permission)
    return createTextErrorResponse('User not found', 404, origin);
  if (permission.blacklisted || isUserRole(permission)) {
    return createTextErrorResponse('Forbidden', 403, origin);
  }
  return null;
}

export async function getOrCreateUserProxy(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const session = await requireProxySession(req, env);
  if (session instanceof Response) return session;
  const actorIsAdmin = isSuperAdmin(session.permission);

  if (req.method === 'GET') {
    const target = parseTargetEmail({
      actorEmail: session.email,
      actorIsAdmin,
      requestedEmail: new URL(req.url).searchParams.get('email') ?? undefined,
      action: 'view',
      origin,
    });
    if (!target.ok) return target.response;
    const targetError = await requireEligibleTarget(target.email, env, origin);
    if (targetError) return targetError;
    const proxy = await getProxySettings(env, target.email);
    return createJsonResponse(
      {
        isAllowed: true,
        canEdit: actorIsAdmin || target.email === session.email,
        proxy,
      },
      200,
      origin
    );
  }

  const body = await readUpdateBody(req);
  if (body instanceof Response) return body;
  const target = parseTargetEmail({
    actorEmail: session.email,
    actorIsAdmin,
    requestedEmail: body.email,
    action: 'edit',
    origin,
  });
  if (!target.ok) return target.response;
  const targetError = await requireEligibleTarget(target.email, env, origin);
  if (targetError) return targetError;
  const saved = await saveProxySettings({
    env,
    email: target.email,
    actorEmail: session.email,
    actorIsAdmin,
    active: body.active,
    url: body.url,
  });
  if (saved.status === 'attempts_exhausted') {
    return attemptsExhaustedResponse(origin);
  }
  return createJsonResponse(
    { success: true, proxy: saved.settings },
    200,
    origin
  );
}

export async function resetAdminProxyAttempts(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const session = await requireAdminProxySession(req, env);
  if (session instanceof Response) return session;
  const parsed: unknown = await req.json().catch(() => null);
  const email =
    parsed &&
    typeof parsed === 'object' &&
    'email' in parsed &&
    typeof parsed.email === 'string'
      ? parsed.email.trim().toLowerCase()
      : '';
  if (!email) {
    return createJsonResponse(
      { code: 'missing_email', message: 'Email is required.' },
      400,
      origin
    );
  }
  const targetError = await requireEligibleTarget(email, env, origin);
  if (targetError) return targetError;
  const proxy = await resetProxyAttempts(env, email, session.email);
  return createJsonResponse({ success: true, proxy }, 200, origin);
}

export async function listAdminProxiesPage(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const session = await requireAdminProxySession(req, env);
  if (session instanceof Response) return session;

  try {
    const request = parsePaginationRequest(new URL(req.url));
    const afterEmail = request.cursor
      ? decodePaginationCursor('admin-proxies', request.cursor)
      : undefined;
    const result = await listProxySettingsPage(env, {
      afterEmail,
      limit: request.limit,
    });
    const nextCursor = result.nextEmail
      ? encodePaginationCursor('admin-proxies', result.nextEmail)
      : null;
    return createJsonResponse(
      {
        version: 1,
        items: result.settings,
        page: {
          nextCursor,
          hasMore: nextCursor !== null,
          total: result.total,
        },
      },
      200,
      origin
    );
  } catch (error) {
    if (error instanceof InvalidPaginationCursorError) {
      return createJsonErrorResponse(
        'Invalid cursor or page limit',
        400,
        origin
      );
    }
    console.error('Error fetching proxy page:', error);
    return createJsonErrorResponse('Proxy data unavailable', 502, origin);
  }
}
