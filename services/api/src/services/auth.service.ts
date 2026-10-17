import { SignJWT, jwtVerify } from 'jose';

import {
  ALLOWED_CLIENTS,
  ALLOWED_ORIGINS,
  COOKIE_DOMAIN,
  COOKIE_MAX_AGE,
  JWT_EXPIRATION_TIME,
  REDIRECT_URLS,
} from '@/config/client.config';
import {
  createCorsHeaders,
  createJsonResponse,
  createJsonErrorResponse,
  createTextErrorResponse,
  getRequestOrigin,
} from '@/http/responses';
import {
  defaultRoleForEmail,
  getPermissionAccessLevel,
  getPermissionRole,
  getUserPermission,
  setUserPermission,
} from '@/repositories/permissions.repo';
import { revokeToken } from '@/repositories/token-blacklist.repo';
import { parseCookies } from '@/utils/cookies';
import { isAllowedEmailDomain } from '@/utils/email-domains';
import { sanitizeProfile } from '@/utils/profile';
import { buildGithubAvatarUrl } from '@/utils/profile-picture';
import type { Env } from '@/types/env';
import { sendEmail } from '@/services/mailer.service';
import { parseMagicCodeRequestDto } from '@/dto/auth/magic-code-request.dto';
import { parseSignupRequestDto } from '@/dto/auth/signup-request.dto';
import { parseVerifyMagicCodeRequestDto } from '@/dto/auth/verify-magic-code-request.dto';
import {
  requireAllowedClientId as requireAllowedSessionClientId,
  verifySessionToken,
} from '@/middleware/session';

const MAGIC_CODE_TTL_SECONDS = 300;
const MAGIC_CODE_DIGIT_COUNT = 6;

function requireAllowedClientId(
  req: Request,
  origin: string
): string | Response {
  const clientId = req.headers.get('X-Client-Id');
  if (!clientId) {
    return createTextErrorResponse('Missing client context', 400, origin);
  }

  if (!ALLOWED_CLIENTS[clientId]) {
    return createTextErrorResponse('Unauthorized client_id', 403, origin);
  }

  return clientId;
}

function createEmailDomainErrorResponse(origin: string): Response {
  return createJsonResponse(
    {
      error: 'Unauthorized email domain',
      message:
        'Access is restricted to University of Peradeniya Google Workspace accounts. Please sign in using your official @pdn.ac.lk or @sci.pdn.ac.lk email address. Personal Gmail or other email accounts are not permitted.',
      allowed_domains: ['pdn.ac.lk', 'sci.pdn.ac.lk'],
    },
    400,
    origin
  );
}

function createMissingEmailResponse(origin: string): Response {
  return createJsonErrorResponse('Email required', 400, origin);
}

function createDtoErrorResponse(
  error: { code: string; field?: string; message: string },
  origin: string
): Response {
  return createJsonResponse(
    {
      code: error.code,
      message: error.message,
      ...(error.field ? { field: error.field } : {}),
    },
    400,
    origin
  );
}

async function readJsonBody(req: Request, origin: string): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return createJsonResponse(
      {
        code: 'invalid_body',
        message: 'Request body must be valid JSON',
      },
      400,
      origin
    );
  }
}

function buildSessionJwtPayload(
  email: string,
  clientId: string,
  env: Env,
  claims: Record<string, unknown>
): SignJWT {
  return new SignJWT({
    sub: email,
    email,
    ...claims,
    iss: env.JWT_ISSUER,
    aud: clientId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRATION_TIME)
    .setJti(crypto.randomUUID());
}

async function issueSessionToken(
  email: string,
  clientId: string,
  env: Env,
  claims: Record<string, unknown>
): Promise<string> {
  return buildSessionJwtPayload(email, clientId, env, claims).sign(
    new TextEncoder().encode(env.JWT_SECRET)
  );
}

function createMagicCodeEmailHtml(email: string, code: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1a1a2e;">SCS Portal - Sign In</h2>
      <p style="color: #333; font-size: 16px;">
        Use the verification code below to sign in to your SCS Portal account.
      </p>
      <p style="color: #555; font-size: 14px;">
        This code was requested for:
        <strong style="color: #1a1a2e;">${email}</strong>
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <span
          style="
            display: inline-block;
            padding: 16px 32px;
            background: #f0f0f0;
            color: #1a1a2e;
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 8px;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
          "
        >
          ${code}
        </span>
      </div>
      <p style="color: #333; font-size: 16px;">
        This code expires in <strong>5 minutes</strong>.
      </p>
      <p style="color: #666; font-size: 14px;">
        If you didn't request this code, you can safely ignore this email.
      </p>
    </div>
  `;
}

function createMagicCodeEmailText(email: string, code: string): string {
  return [
    'SCS Portal - Sign In',
    '',
    `This verification code was requested for: ${email}`,
    '',
    `Verification code: ${code}`,
    '',
    'This code expires in 5 minutes.',
    '',
    "If you didn't request this code, you can safely ignore this email.",
  ].join('\n');
}

function generateMagicCode(): string {
  return String(
    crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000
  ).padStart(MAGIC_CODE_DIGIT_COUNT, '0');
}

export async function registerUserAndIssueSession(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const clientId = requireAllowedClientId(req, origin);
  if (clientId instanceof Response) return clientId;

  const body = await readJsonBody(req, origin);
  if (body instanceof Response) return body;

  const dto = parseSignupRequestDto(body);
  if (!dto.ok) {
    return dto.error.code === 'email_required'
      ? createMissingEmailResponse(origin)
      : createDtoErrorResponse(dto.error, origin);
  }

  const { email, name, picture } = dto.value;

  const { name: sanitizedName, picture: sanitizedPicture } = sanitizeProfile(
    name,
    picture
  );

  if (!isAllowedEmailDomain(email)) {
    return createEmailDomainErrorResponse(origin);
  }

  const permission = await getUserPermission(email, env);
  let createdPermission:
    | {
        role: ReturnType<typeof defaultRoleForEmail>;
        name?: string;
        picture?: string;
        createdAt: number;
      }
    | undefined;

  if (!permission) {
    createdPermission = {
      role: defaultRoleForEmail(email),
      name: sanitizedName,
      picture: sanitizedPicture,
      createdAt: Date.now(),
    };
    await setUserPermission(email, createdPermission, env);
  }

  const token = await issueSessionToken(email, clientId, env, {
    name: sanitizedName,
    picture: sanitizedPicture,
    role: getPermissionRole(permission ?? createdPermission),
    accessLevel: getPermissionAccessLevel(permission ?? createdPermission),
  });

  return Response.json({ token });
}

export async function issueSessionJwt(
  req: Request,
  env: Env,
  clientId: string,
  provider?: 'google' | 'github'
) {
  const origin = getRequestOrigin(req);

  if (!ALLOWED_CLIENTS[clientId]) {
    return createTextErrorResponse('Unauthorized client_id', 403, origin);
  }

  const body = await readJsonBody(req, origin);
  if (body instanceof Response) return body;

  const dto = parseSignupRequestDto(body);
  if (!dto.ok) {
    return dto.error.code === 'email_required'
      ? createMissingEmailResponse(origin)
      : createDtoErrorResponse(dto.error, origin);
  }

  const { email, name, picture } = dto.value;

  if (!isAllowedEmailDomain(email)) {
    return createEmailDomainErrorResponse(origin);
  }

  const permission = await getUserPermission(email, env);
  if (!permission) {
    return createJsonErrorResponse('Forbidden', 403, origin);
  }

  const { picture: sanitizedPicture } = sanitizeProfile(name, picture);
  const shouldUseProviderPicture =
    sanitizedPicture &&
    (!permission.pictureMode || permission.pictureMode === provider);
  const providerPicture =
    provider === 'github' &&
    permission.pictureMode === 'github' &&
    permission.githubUserID
      ? buildGithubAvatarUrl(permission.githubUserID)
      : sanitizedPicture;

  const updatedPermission = {
    ...permission,
    ...(shouldUseProviderPicture ? { picture: providerPicture } : {}),
  };

  await setUserPermission(email, updatedPermission, env);

  const token = await issueSessionToken(email, clientId, env, {
    name: permission.name,
    picture: updatedPermission.picture,
    role: getPermissionRole(updatedPermission),
    accessLevel: getPermissionAccessLevel(updatedPermission),
  });

  return Response.json(
    { token },
    { status: 200, headers: createCorsHeaders(origin) }
  );
}

export async function sendMagicCode(req: Request, env: Env): Promise<Response> {
  const origin = getRequestOrigin(req);
  const clientId = requireAllowedClientId(req, origin);
  if (clientId instanceof Response) return clientId;

  const body = await readJsonBody(req, origin);
  if (body instanceof Response) return body;

  const dto = parseMagicCodeRequestDto(body);
  if (!dto.ok) {
    return dto.error.code === 'email_required'
      ? createMissingEmailResponse(origin)
      : createDtoErrorResponse(dto.error, origin);
  }

  const { email } = dto.value;
  const sanitizedEmail = email.trim().toLowerCase();

  if (!isAllowedEmailDomain(email)) {
    return createJsonResponse(
      {
        error: 'Unauthorized email domain',
        message: 'Use your @pdn.ac.lk or @sci.pdn.ac.lk email.',
      },
      400,
      origin
    );
  }

  const code = generateMagicCode();
  await env.MAGIC_CODES.put(code, sanitizedEmail, {
    expirationTtl: MAGIC_CODE_TTL_SECONDS,
  });

  try {
    await sendEmail(
      {
        to: email,
        subject: 'SCS Portal - Sign In Code',
        html: createMagicCodeEmailHtml(email, code),
        text: createMagicCodeEmailText(email, code),
      },
      env.MAILER_API_URL,
      env.MAILER_API_KEY
    );
  } catch (error) {
    console.error('Failed to send magic code email:', error);
    return createJsonErrorResponse(
      'Failed to send email. Please try again later.',
      500,
      origin
    );
  }

  return createJsonResponse(
    { message: 'Magic code sent', expiresIn: MAGIC_CODE_TTL_SECONDS },
    200,
    origin
  );
}

export async function verifyMagicCodeAndIssueSession(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const clientId = requireAllowedClientId(req, origin);
  if (clientId instanceof Response) return clientId;

  const body = await readJsonBody(req, origin);
  if (body instanceof Response) return body;

  const dto = parseVerifyMagicCodeRequestDto(body);
  if (!dto.ok) {
    return createJsonErrorResponse('magic_code_missing', 400, origin);
  }

  const { email, code } = dto.value;
  const sanitizedEmail = email.trim().toLowerCase();

  const storedEmail = await env.MAGIC_CODES.get(code);
  if (!storedEmail || storedEmail !== sanitizedEmail) {
    return createJsonErrorResponse('magic_code_invalid', 401, origin);
  }

  await env.MAGIC_CODES.delete(code);

  let permission = await getUserPermission(email, env);
  if (!permission) {
    await setUserPermission(
      email,
      { role: defaultRoleForEmail(email), createdAt: Date.now() },
      env
    );
    permission = await getUserPermission(email, env);
  }

  const sessionToken = await issueSessionToken(email, clientId, env, {
    name: permission?.name,
    picture: permission?.picture,
    role: getPermissionRole(permission),
    accessLevel: getPermissionAccessLevel(permission),
  });

  const headers = new Headers(createCorsHeaders(origin));
  headers.append(
    'Set-Cookie',
    `session=${sessionToken}; HttpOnly; Secure; SameSite=Lax; Domain=${COOKIE_DOMAIN}; Path=/; Max-Age=${COOKIE_MAX_AGE}`
  );

  return Response.json(
    { verified: true, redirectTo: REDIRECT_URLS[clientId] },
    { status: 200, headers }
  );
}

export async function verifySessionJwt(
  req: Request,
  env: Env
): Promise<Response> {
  const clientId = requireAllowedSessionClientId(req, ALLOWED_CLIENTS);
  if (clientId instanceof Response) return clientId;

  const payload = await verifySessionToken(req, env, clientId);
  if (payload instanceof Response) return payload;

  return Response.json({
    valid: true,
    email: payload.email,
    role: payload.role,
    accessLevel: payload.accessLevel,
  });
}

export async function revokeSession(req: Request, env: Env): Promise<Response> {
  const origin = getRequestOrigin(req);
  const token = parseCookies(req.headers.get('Cookie')).session;
  const headers = new Headers();

  if (ALLOWED_ORIGINS.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }
  headers.set('Access-Control-Allow-Credentials', 'true');

  if (!token) {
    return new Response(null, { status: 200, headers });
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(env.JWT_SECRET),
      { issuer: env.JWT_ISSUER }
    );

    const clientId = payload.aud as string;
    if (!clientId || !ALLOWED_CLIENTS[clientId]) {
      return new Response(null, { status: 200, headers });
    }

    const jti = payload.jti as string;
    const exp = payload.exp as number;

    const now = Math.floor(Date.now() / 1000);
    const ttl = exp - now;
    if (ttl > 0) {
      await revokeToken(jti, ttl, env);
    }

    headers.append(
      'Set-Cookie',
      `session=; HttpOnly; Secure; SameSite=Lax; Domain=${COOKIE_DOMAIN}; Path=/; Max-Age=0`
    );
    headers.append(
      'Set-Cookie',
      `oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
    );

    return new Response(null, { status: 200, headers });
  } catch {
    return new Response(null, { status: 200, headers });
  }
}
