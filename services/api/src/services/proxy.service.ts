import { jwtVerify, SignJWT } from 'jose';

import { callGithubApp } from '@/clients/github-app.client';
import {
  PROXY_ATTEMPTS_RESET_WINDOW_MS,
  PROXY_DEFAULT_AVAILABLE_ATTEMPTS,
} from '@/config/client.config';
import {
  proxyUpdateRequestSchema,
  type ProxyUpdateRequestDto,
} from '@/dto/proxy/proxy-update-request.dto';
import {
  createCorsHeaders,
  createJsonErrorResponse,
  createJsonResponse,
  createTextErrorResponse,
  getRequestOrigin,
} from '@/http/responses';
import {
  getAllUserData,
  getUserPermission,
  isSuperAdmin,
  isUserRole,
  type Permission,
} from '@/repositories/permissions.repo';
import type { Env } from '@/types/env';
import { parseCookies } from '@/utils/cookies';

interface ProxySession {
  email: string;
  permission: Permission;
}

interface ProxyConfig {
  active: boolean;
  url: string;
  availableAttempts: number;
  updatedAt?: string;
  updatedBy?: string;
}

interface UserAccessConfig {
  proxy: ProxyConfig;
  permissions?: {
    repo?: Record<string, unknown>;
  };
}

interface AdminProxyEntry extends ProxyConfig {
  email: string;
  username: string;
}

const USER_PROXY_READ_TOKEN_TTL_SECONDS = 120;
const ADMIN_PROXY_READ_TOKEN_TTL_SECONDS = 60;

function emailToUsername(email: string): string {
  return email.split('@')[0]?.toLowerCase() ?? email.toLowerCase();
}

function configDataUrl(env: Env, path: string, accessToken: string): string {
  const url = new URL(path, env.CONFIG_DATA_BASE_URL);
  url.searchParams.set('access_token', accessToken);
  return url.toString();
}

async function createConfigReadToken(input: {
  env: Env;
  email: string;
  path: string;
  scope: 'proxy:read:self' | 'proxy:read:all';
  ttlSeconds: number;
}): Promise<string> {
  return await new SignJWT({
    scope: input.scope,
    path: input.path,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(input.email)
    .setIssuer(input.env.JWT_ISSUER)
    .setAudience('config.scs.pdn.ac.lk')
    .setIssuedAt()
    .setExpirationTime(`${input.ttlSeconds}s`)
    .setJti(crypto.randomUUID())
    .sign(new TextEncoder().encode(input.env.CONFIG_ACCESS_TOKEN_SECRET));
}

async function createSignedConfigReadUrl(input: {
  env: Env;
  email: string;
  path: string;
  scope: 'proxy:read:self' | 'proxy:read:all';
  ttlSeconds: number;
}): Promise<{ url: string; expiresAt: string }> {
  const token = await createConfigReadToken(input);
  return {
    url: configDataUrl(input.env, input.path, token),
    expiresAt: new Date(Date.now() + input.ttlSeconds * 1000).toISOString(),
  };
}

function defaultProxyConfig(): ProxyConfig {
  return {
    active: false,
    url: '',
    availableAttempts: PROXY_DEFAULT_AVAILABLE_ATTEMPTS,
  };
}

function normalizeProxyConfig(
  value: Partial<ProxyConfig> | undefined
): ProxyConfig {
  return {
    ...defaultProxyConfig(),
    ...value,
    availableAttempts:
      typeof value?.availableAttempts === 'number'
        ? value.availableAttempts
        : PROXY_DEFAULT_AVAILABLE_ATTEMPTS,
  };
}

function shouldResetAttempts(proxy: ProxyConfig): boolean {
  if (!proxy.updatedAt) return false;
  const updatedAt = Date.parse(proxy.updatedAt);
  return (
    Number.isFinite(updatedAt) &&
    Date.now() - updatedAt > PROXY_ATTEMPTS_RESET_WINDOW_MS
  );
}

async function getUserAccessConfig(
  username: string,
  env: Env,
  origin: string
): Promise<
  { ok: true; proxy: ProxyConfig } | { ok: false; response: Response }
> {
  const response = await callGithubApp<UserAccessConfig>(
    env,
    origin,
    `/user/access-config?username=${encodeURIComponent(username)}`
  );
  if (!response.ok) return response;

  return {
    ok: true,
    proxy: normalizeProxyConfig(response.value.proxy),
  };
}

async function saveUserProxyConfig(input: {
  username: string;
  email: string;
  updatedBy: string;
  proxy: ProxyConfig;
  env: Env;
  origin: string;
}): Promise<
  { ok: true; proxy: ProxyConfig } | { ok: false; response: Response }
> {
  const response = await callGithubApp<{
    success: boolean;
    automation: unknown;
  }>(input.env, input.origin, '/user/proxy-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: input.username,
      email: input.email,
      updatedBy: input.updatedBy,
      active: input.proxy.active,
      url: input.proxy.url,
      availableAttempts: input.proxy.availableAttempts,
    }),
  });
  if (!response.ok) return response;

  return { ok: true, proxy: input.proxy };
}

export async function getUserProxyReadUrl(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const session = await requireProxySession(req, env);
  if (session instanceof Response) return session;

  const path = `/config/v1/${emailToUsername(session.email)}.json`;
  const signed = await createSignedConfigReadUrl({
    env,
    email: session.email,
    path,
    scope: 'proxy:read:self',
    ttlSeconds: USER_PROXY_READ_TOKEN_TTL_SECONDS,
  });

  return createJsonResponse(signed, 200, origin);
}

export async function getAdminProxyAllReadUrl(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const session = await requireAdminProxySession(req, env);
  if (session instanceof Response) return session;

  const signed = await createSignedConfigReadUrl({
    env,
    email: session.email,
    path: '/config/v1/all.json',
    scope: 'proxy:read:all',
    ttlSeconds: ADMIN_PROXY_READ_TOKEN_TTL_SECONDS,
  });

  return createJsonResponse(signed, 200, origin);
}

async function requireProxySession(
  req: Request,
  env: Env
): Promise<ProxySession | Response> {
  const origin = getRequestOrigin(req);
  const session = parseCookies(req.headers.get('Cookie')).session;
  if (!session) {
    return createTextErrorResponse('Unauthorized', 401, origin);
  }

  const clientId = req.headers.get('X-Client-Id');
  if (!clientId) {
    return createTextErrorResponse('Missing X-Client-Id header', 400, origin);
  }

  let payload: { email: string };
  try {
    ({ payload } = await jwtVerify(
      session,
      new TextEncoder().encode(env.JWT_SECRET),
      {
        issuer: env.JWT_ISSUER,
        audience: clientId,
      }
    ));
  } catch (error) {
    console.error('JWT verification failed:', error);
    return createTextErrorResponse('Invalid token', 401, origin);
  }

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
  action: 'edit' | 'view' | 'reset';
  origin: string;
}): { ok: true; email: string } | { ok: false; response: Response } {
  const requestedEmail = input.requestedEmail?.trim().toLowerCase();
  if (!requestedEmail || requestedEmail === input.actorEmail) {
    return { ok: true, email: input.actorEmail };
  }

  if (!input.actorIsAdmin) {
    const verb =
      input.action === 'view'
        ? 'view'
        : input.action === 'reset'
          ? 'reset'
          : 'edit';
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
  body: ReturnType<typeof proxyUpdateRequestSchema.safeParse>,
  origin: string
): Response | null {
  if (body.success) return null;

  const issue = body.error.issues[0];
  const field = typeof issue.path[0] === 'string' ? issue.path[0] : undefined;
  return createJsonResponse(
    field === 'url'
      ? {
          code: 'invalid_proxy_url',
          message: 'Enter a valid HTTP or HTTPS proxy URL.',
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
    {
      status: 409,
      headers: createCorsHeaders(origin),
    }
  );
}

async function readUpdateBody(
  req: Request
): Promise<ProxyUpdateRequestDto | Response> {
  const origin = getRequestOrigin(req);
  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch (error) {
    console.error('Failed to parse JSON body:', error);
    return createTextErrorResponse('Invalid JSON body', 400, origin);
  }

  const validatedBody = proxyUpdateRequestSchema.safeParse(parsed);
  const errorResponse = parseProxyBodyError(validatedBody, origin);
  if (errorResponse) return errorResponse;
  if (!validatedBody.success) {
    return createJsonErrorResponse('Invalid proxy update', 400, origin);
  }

  return validatedBody.data;
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
    const requestedEmail =
      new URL(req.url).searchParams.get('email') ?? undefined;
    const target = parseTargetEmail({
      actorEmail: session.email,
      actorIsAdmin,
      requestedEmail,
      action: 'view',
      origin,
    });
    if (!target.ok) return target.response;

    const config = await getUserAccessConfig(
      emailToUsername(target.email),
      env,
      origin
    );
    if (!config.ok) return config.response;

    return createJsonResponse(
      {
        isAllowed: true,
        canEdit: actorIsAdmin || target.email === session.email,
        proxy: config.proxy,
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

  const targetPermission = await getUserPermission(target.email, env);
  if (!targetPermission) {
    return createTextErrorResponse('User not found', 404, origin);
  }
  if (targetPermission.blacklisted || isUserRole(targetPermission)) {
    return createTextErrorResponse('Forbidden', 403, origin);
  }

  const current = await getUserAccessConfig(
    emailToUsername(target.email),
    env,
    origin
  );
  if (!current.ok) return current.response;

  const shouldDecreaseAttempt = !actorIsAdmin;
  const resetAttempts = shouldResetAttempts(current.proxy);
  const availableAttempts = resetAttempts
    ? PROXY_DEFAULT_AVAILABLE_ATTEMPTS
    : current.proxy.availableAttempts;

  if (shouldDecreaseAttempt && availableAttempts <= 0) {
    return attemptsExhaustedResponse(origin);
  }

  const nextProxy: ProxyConfig = {
    ...current.proxy,
    availableAttempts: shouldDecreaseAttempt
      ? availableAttempts - 1
      : availableAttempts,
    active: 'active' in body ? !!body.active : current.proxy.active,
    url: 'url' in body && body.url !== undefined ? body.url : current.proxy.url,
  };

  const saved = await saveUserProxyConfig({
    username: emailToUsername(target.email),
    email: target.email,
    updatedBy: session.email,
    proxy: nextProxy,
    env,
    origin,
  });
  if (!saved.ok) return saved.response;

  return createJsonResponse({ success: true, proxy: saved.proxy }, 200, origin);
}

export async function listUserProxies(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const session = await requireAdminProxySession(req, env);
  if (session instanceof Response) return session;

  const requestedPage = Number(new URL(req.url).searchParams.get('page') ?? 1);
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const users = await getAllUserData(env);
  const entries: AdminProxyEntry[] = [];

  for (const user of users) {
    const config = await getUserAccessConfig(
      emailToUsername(user.email),
      env,
      origin
    );
    if (!config.ok) continue;
    const proxy = config.proxy;
    if (!proxy.active && !proxy.url && !proxy.updatedAt) continue;
    entries.push({
      email: user.email,
      username: emailToUsername(user.email),
      ...proxy,
    });
  }

  const sortedEntries = entries.sort((a, b) => a.email.localeCompare(b.email));
  const total = sortedEntries.length;
  const totalPages = Math.max(1, Math.ceil(total / 100));
  const start = (page - 1) * 100;

  return createJsonResponse(
    {
      proxies: sortedEntries.slice(start, start + 100),
      page,
      totalPages,
      total,
    },
    200,
    origin
  );
}

export async function resetUserProxyAttempts(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const session = await requireProxySession(req, env);
  if (session instanceof Response) return session;

  let parsed: unknown = {};
  try {
    parsed = await req.json();
  } catch {
    parsed = {};
  }

  const validatedBody = proxyUpdateRequestSchema.safeParse(parsed);
  const errorResponse = parseProxyBodyError(validatedBody, origin);
  if (errorResponse) return errorResponse;
  if (!validatedBody.success) {
    return createJsonErrorResponse('Invalid proxy update', 400, origin);
  }

  const target = parseTargetEmail({
    actorEmail: session.email,
    actorIsAdmin: isSuperAdmin(session.permission),
    requestedEmail: validatedBody.data.email,
    action: 'reset',
    origin,
  });
  if (!target.ok) return target.response;

  const current = await getUserAccessConfig(
    emailToUsername(target.email),
    env,
    origin
  );
  if (!current.ok) return current.response;

  const saved = await saveUserProxyConfig({
    username: emailToUsername(target.email),
    email: target.email,
    updatedBy: session.email,
    proxy: {
      ...current.proxy,
      availableAttempts: PROXY_DEFAULT_AVAILABLE_ATTEMPTS,
    },
    env,
    origin,
  });
  if (!saved.ok) return saved.response;

  return createJsonResponse({ success: true, proxy: saved.proxy }, 200, origin);
}

export async function resetAdminProxyAttempts(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const session = await requireAdminProxySession(req, env);
  if (session instanceof Response) return session;

  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return createJsonResponse(
      { code: 'invalid_json_body', message: 'Invalid JSON body' },
      400,
      origin
    );
  }

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

  const targetPermission = await getUserPermission(email, env);
  if (!targetPermission) {
    return createJsonResponse(
      { code: 'proxy_not_found', message: 'Proxy entry not found.' },
      404,
      origin
    );
  }

  const current = await getUserAccessConfig(
    emailToUsername(email),
    env,
    origin
  );
  if (!current.ok) return current.response;

  const saved = await saveUserProxyConfig({
    username: emailToUsername(email),
    email,
    updatedBy: session.email,
    proxy: {
      ...current.proxy,
      availableAttempts: PROXY_DEFAULT_AVAILABLE_ATTEMPTS,
    },
    env,
    origin,
  });
  if (!saved.ok) return saved.response;

  return createJsonResponse({ success: true, proxy: saved.proxy }, 200, origin);
}

export async function buildAdminProxyManifest(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const session = await requireAdminProxySession(req, env);
  if (session instanceof Response) return session;

  const users = await getAllUserData(env);
  const proxies: AdminProxyEntry[] = [];

  for (const user of users) {
    const config = await getUserAccessConfig(
      emailToUsername(user.email),
      env,
      origin
    );
    if (!config.ok || !config.proxy.active) continue;
    proxies.push({
      email: user.email,
      username: emailToUsername(user.email),
      ...config.proxy,
    });
  }

  return createJsonResponse(
    {
      success: true,
      generatedAt: Date.now(),
      proxies,
    },
    200,
    origin
  );
}
