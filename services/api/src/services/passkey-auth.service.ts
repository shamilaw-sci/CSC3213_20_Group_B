import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
  WebAuthnCredential,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { jwtVerify, SignJWT } from 'jose';

import {
  ALLOWED_CLIENTS,
  ALLOWED_ORIGINS,
  COOKIE_DOMAIN,
  JWT_EXPIRATION_TIME,
  PASSKEY_CHALLENGE_COOKIE,
  PASSKEY_CHALLENGE_MAX_AGE,
  PASSKEY_LIMIT,
  PASSKEY_RP_IDS,
  PASSKEY_RP_NAME,
  COOKIE_MAX_AGE,
} from '@/config/client.config';
import {
  getPermissionRole,
  getPermissionAccessLevel,
  getUserPermission,
  isSuperAdmin,
  isUserRole,
  type PasskeyCredential,
  setUserPermission,
} from '@/repositories/permissions.repo';
import { isTokenRevoked } from '@/repositories/token-blacklist.repo';
import { createCorsHeaders, createJsonErrorResponse } from '@/http/responses';
import { parseCookies } from '@/utils/cookies';
import { isAllowedEmailDomain } from '@/utils/email-domains';
import type { Env } from '@/types/env';

type ChallengePayload = {
  type: 'passkey_registration' | 'passkey_authentication';
  challenge: string;
  clientId: string;
  email: string;
  origin: string;
  rpId: string;
  passkeyName?: string;
};

type RegistrationOptionsBody = {
  name?: unknown;
};

type RegistrationVerificationBody = {
  response?: RegistrationResponseJSON;
};

type AuthenticationOptionsBody = {
  email?: unknown;
};

type AuthenticationVerificationBody = {
  response?: AuthenticationResponseJSON;
};

function getClientId(req: Request): string | Response {
  const clientId = req.headers.get('X-Client-Id');
  if (!clientId) return new Response('Missing client context', { status: 400 });
  if (!ALLOWED_CLIENTS[clientId]) {
    return new Response('Unauthorized client_id', { status: 403 });
  }
  return clientId;
}

function getRpContext(
  req: Request
): { origin: string; rpId: string } | Response {
  const origin = req.headers.get('origin') || '';
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return Response.json({ error: 'Forbidden origin' }, { status: 403 });
  }

  const rpId = PASSKEY_RP_IDS[origin];
  if (!rpId) {
    return createJsonErrorResponse(
      'Passkeys are not configured for this origin',
      400,
      origin
    );
  }

  return { origin, rpId };
}

async function createChallengeCookie(
  payload: ChallengePayload,
  env: Env
): Promise<string> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${PASSKEY_CHALLENGE_MAX_AGE}s`)
    .setJti(crypto.randomUUID())
    .sign(new TextEncoder().encode(env.JWT_SECRET));

  return `${PASSKEY_CHALLENGE_COOKIE}=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${PASSKEY_CHALLENGE_MAX_AGE}`;
}

function clearChallengeCookie(): string {
  return `${PASSKEY_CHALLENGE_COOKIE}=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`;
}

async function readChallengeCookie(
  req: Request,
  env: Env,
  expectedType: ChallengePayload['type']
): Promise<ChallengePayload | Response> {
  const token = parseCookies(req.headers.get('Cookie'))[
    PASSKEY_CHALLENGE_COOKIE
  ];
  if (!token) {
    return createJsonErrorResponse(
      'Missing passkey challenge',
      401,
      req.headers.get('origin') || ''
    );
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(env.JWT_SECRET)
    );

    if (
      payload.type !== expectedType ||
      typeof payload.challenge !== 'string' ||
      typeof payload.clientId !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.origin !== 'string' ||
      typeof payload.rpId !== 'string' ||
      (payload.passkeyName !== undefined &&
        typeof payload.passkeyName !== 'string')
    ) {
      return createJsonErrorResponse(
        'Invalid passkey challenge',
        401,
        req.headers.get('origin') || ''
      );
    }

    return payload as ChallengePayload;
  } catch {
    return createJsonErrorResponse(
      'Invalid or expired passkey challenge',
      401,
      req.headers.get('origin') || ''
    );
  }
}

async function getSessionEmail(
  req: Request,
  env: Env,
  clientId: string
): Promise<string | Response> {
  const token = parseCookies(req.headers.get('Cookie')).session;
  if (!token) {
    return createJsonErrorResponse(
      'Missing session',
      401,
      req.headers.get('origin') || ''
    );
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(env.JWT_SECRET),
      {
        issuer: env.JWT_ISSUER,
        audience: clientId,
      }
    );

    const jti = payload.jti;
    if (typeof jti === 'string' && (await isTokenRevoked(jti, env))) {
      return createJsonErrorResponse(
        'Token revoked',
        401,
        req.headers.get('origin') || ''
      );
    }

    if (typeof payload.email !== 'string') {
      return createJsonErrorResponse(
        'Invalid session',
        401,
        req.headers.get('origin') || ''
      );
    }

    return payload.email;
  } catch {
    return createJsonErrorResponse(
      'Invalid session',
      401,
      req.headers.get('origin') || ''
    );
  }
}

async function issueSessionToken(
  email: string,
  clientId: string,
  env: Env
): Promise<string> {
  const permission = await getUserPermission(email, env);

  return new SignJWT({
    sub: email,
    email,
    name: permission?.name,
    picture: permission?.picture,
    role: getPermissionRole(permission),
    accessLevel: getPermissionAccessLevel(permission),
    iss: env.JWT_ISSUER,
    aud: clientId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRATION_TIME)
    .setJti(crypto.randomUUID())
    .sign(new TextEncoder().encode(env.JWT_SECRET));
}

function toWebAuthnCredential(
  credential: PasskeyCredential
): WebAuthnCredential {
  return {
    id: credential.id,
    publicKey: isoBase64URL.toBuffer(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports,
  };
}

export async function passkeyRegistrationOptions(req: Request, env: Env) {
  const clientId = getClientId(req);
  if (clientId instanceof Response) return clientId;

  const rpContext = getRpContext(req);
  if (rpContext instanceof Response) return rpContext;

  const email = await getSessionEmail(req, env, clientId);
  if (email instanceof Response) return email;

  const permission = await getUserPermission(email, env);
  if (!permission || permission.blacklisted || isUserRole(permission)) {
    return createJsonErrorResponse(
      'Forbidden',
      403,
      req.headers.get('origin') || ''
    );
  }

  const body = (await req.json().catch(() => ({}))) as RegistrationOptionsBody;
  const passkeys = permission.passkeys ?? [];

  if (passkeys.length >= PASSKEY_LIMIT) {
    return Response.json(
      {
        code: 'passkey_limit_reached',
        message: 'You can save up to 4 passkeys for this account.',
      },
      {
        status: 409,
        headers: createCorsHeaders(req.headers.get('origin') || ''),
      }
    );
  }

  const options = await generateRegistrationOptions({
    rpName: PASSKEY_RP_NAME,
    rpID: rpContext.rpId,
    userName: email,
    userDisplayName:
      typeof body.name === 'string' && body.name.trim()
        ? body.name.trim()
        : (permission.name ?? email),
    attestationType: 'none',
    excludeCredentials: passkeys
      .filter((credential) => credential.rpId === rpContext.rpId)
      .map((credential) => ({
        id: credential.id,
        transports: credential.transports,
      })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
    },
  });

  const headers = new Headers(createCorsHeaders(rpContext.origin));
  headers.append(
    'Set-Cookie',
    await createChallengeCookie(
      {
        type: 'passkey_registration',
        challenge: options.challenge,
        clientId,
        email,
        origin: rpContext.origin,
        rpId: rpContext.rpId,
        passkeyName:
          typeof body.name === 'string' && body.name.trim()
            ? body.name.trim()
            : undefined,
      },
      env
    )
  );

  return Response.json(options, { status: 200, headers });
}

export async function passkeyRegistrationVerification(req: Request, env: Env) {
  const clientId = getClientId(req);
  if (clientId instanceof Response) return clientId;

  const challenge = await readChallengeCookie(req, env, 'passkey_registration');
  if (challenge instanceof Response) return challenge;
  if (challenge.clientId !== clientId) {
    return createJsonErrorResponse(
      'Invalid client context',
      401,
      req.headers.get('origin') || ''
    );
  }

  const body: RegistrationVerificationBody = await req.json();
  if (!body.response)
    return createJsonErrorResponse(
      'Passkey response required',
      400,
      req.headers.get('origin') || ''
    );

  const verification = await verifyRegistrationResponse({
    response: body.response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: challenge.origin,
    expectedRPID: challenge.rpId,
    requireUserVerification: true,
  });

  if (!verification.verified) {
    return createJsonErrorResponse(
      'Passkey registration failed',
      401,
      req.headers.get('origin') || ''
    );
  }

  const permission = await getUserPermission(challenge.email, env);
  if (!permission || permission.blacklisted || isUserRole(permission)) {
    return createJsonErrorResponse(
      'Forbidden',
      403,
      req.headers.get('origin') || ''
    );
  }

  const { credential, credentialBackedUp, credentialDeviceType } =
    verification.registrationInfo;
  const existingPasskeys = permission.passkeys ?? [];
  const passkey: PasskeyCredential = {
    id: credential.id,
    publicKey: isoBase64URL.fromBuffer(credential.publicKey),
    counter: credential.counter,
    transports: body.response.response.transports,
    backedUp: credentialBackedUp,
    deviceType: credentialDeviceType,
    rpId: challenge.rpId,
    createdAt: Date.now(),
    // Use supplied name if present; otherwise generate a unique default like "Passkey 1"
    name: (() => {
      const supplied =
        typeof challenge.passkeyName === 'string' &&
        challenge.passkeyName.trim()
          ? challenge.passkeyName.trim()
          : undefined;
      if (supplied) return supplied;
      const base = 'Passkey';
      const existingNames = new Set(
        existingPasskeys
          .map((p) => p.name)
          .filter((n): n is string => typeof n === 'string')
      );
      let i = 1;
      while (existingNames.has(`${base} ${i}`)) i++;
      return `${base} ${i}`;
    })(),
  };

  if (passkey.name) {
    const conflict = existingPasskeys.find(
      (p) => p.name === passkey.name && p.id !== passkey.id
    );
    if (conflict) {
      const headers = new Headers(createCorsHeaders(challenge.origin));
      headers.append('Set-Cookie', clearChallengeCookie());
      return Response.json(
        {
          code: 'passkey_name_conflict',
          message: 'Passkey name already in use',
        },
        {
          status: 409,
          headers,
        }
      );
    }
  }

  await setUserPermission(
    challenge.email,
    {
      ...permission,
      passkeys: [
        ...existingPasskeys.filter((item) => item.id !== passkey.id),
        passkey,
      ],
    },
    env
  );

  const headers = new Headers(createCorsHeaders(challenge.origin));
  headers.append('Set-Cookie', clearChallengeCookie());
  return Response.json({ verified: true }, { status: 200, headers });
}

export async function passkeyAuthenticationOptions(req: Request, env: Env) {
  const clientId = getClientId(req);
  if (clientId instanceof Response) return clientId;

  const rpContext = getRpContext(req);
  if (rpContext instanceof Response) return rpContext;

  const body = (await req
    .json()
    .catch(() => ({}))) as AuthenticationOptionsBody;
  const email = typeof body.email === 'string' ? body.email.trim() : '';

  // Emailless (discoverable) flow: if no email is provided, return options
  // that allow the browser to present resident (discoverable) credentials.
  if (!email) {
    const options = await generateAuthenticationOptions({
      rpID: rpContext.rpId,
      // allowCredentials omitted so discoverable credentials may be used
      userVerification: 'required',
    });

    const headers = new Headers(createCorsHeaders(rpContext.origin));
    headers.append(
      'Set-Cookie',
      await createChallengeCookie(
        {
          type: 'passkey_authentication',
          challenge: options.challenge,
          clientId,
          email: '',
          origin: rpContext.origin,
          rpId: rpContext.rpId,
        },
        env
      )
    );

    return Response.json(options, { status: 200, headers });
  }

  // Backwards-compatible flow when frontend provides an email (non-discoverable)
  if (!isAllowedEmailDomain(email)) {
    return createJsonErrorResponse(
      'Unauthorized email domain',
      400,
      req.headers.get('origin') || ''
    );
  }

  const permission = await getUserPermission(email, env);
  const passkeys =
    permission?.passkeys?.filter(
      (credential) => credential.rpId === rpContext.rpId
    ) ?? [];
  if (!permission || permission.blacklisted || passkeys.length === 0) {
    return createJsonErrorResponse(
      'Passkey is not registered',
      403,
      req.headers.get('origin') || ''
    );
  }

  const options = await generateAuthenticationOptions({
    rpID: rpContext.rpId,
    allowCredentials: passkeys.map((credential) => ({
      id: credential.id,
      transports: credential.transports,
    })),
    userVerification: 'required',
  });

  const headers = new Headers(createCorsHeaders(rpContext.origin));
  headers.append(
    'Set-Cookie',
    await createChallengeCookie(
      {
        type: 'passkey_authentication',
        challenge: options.challenge,
        clientId,
        email,
        origin: rpContext.origin,
        rpId: rpContext.rpId,
      },
      env
    )
  );

  return Response.json(options, { status: 200, headers });
}

export async function passkeyAuthenticationVerification(
  req: Request,
  env: Env
) {
  const clientId = getClientId(req);
  if (clientId instanceof Response) return clientId;

  const challenge = await readChallengeCookie(
    req,
    env,
    'passkey_authentication'
  );
  if (challenge instanceof Response) return challenge;
  if (challenge.clientId !== clientId) {
    return createJsonErrorResponse(
      'Invalid client context',
      401,
      req.headers.get('origin') || ''
    );
  }

  const body: AuthenticationVerificationBody = await req.json();
  if (!body.response)
    return createJsonErrorResponse(
      'Passkey response required',
      400,
      req.headers.get('origin') || ''
    );
  let permission = null as Awaited<ReturnType<typeof getUserPermission>> | null;
  let passkey: PasskeyCredential | undefined;

  if (!challenge.email) {
    // Discoverable flow: resolve the user by credential id
    const credentialId = body.response.id;
    const list = await env.PERMISSIONS.list({ prefix: 'permissions:' });
    for (const key of list.keys) {
      const email = key.name.slice('permissions:'.length);
      const p = await getUserPermission(email, env);
      if (!p || !p.passkeys) continue;
      const pk = p.passkeys.find(
        (c) => c.id === credentialId && c.rpId === challenge.rpId
      );
      if (pk) {
        permission = p;
        passkey = pk;
        challenge.email = email; // attach resolved email
        break;
      }
    }
  } else {
    permission = await getUserPermission(challenge.email, env);
    passkey = permission?.passkeys?.find(
      (credential) =>
        credential.id === body.response?.id &&
        credential.rpId === challenge.rpId
    );
  }

  if (!permission || permission.blacklisted || !passkey) {
    return createJsonErrorResponse(
      'Passkey is not registered',
      403,
      req.headers.get('origin') || ''
    );
  }

  const verification = await verifyAuthenticationResponse({
    response: body.response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: challenge.origin,
    expectedRPID: challenge.rpId,
    credential: toWebAuthnCredential(passkey),
    requireUserVerification: true,
  });

  if (!verification.verified) {
    return createJsonErrorResponse(
      'Passkey authentication failed',
      401,
      req.headers.get('origin') || ''
    );
  }

  await setUserPermission(
    challenge.email,
    {
      ...permission,
      passkeys: (permission.passkeys ?? []).map((credential) =>
        credential.id === verification.authenticationInfo.credentialID
          ? {
              ...credential,
              counter: verification.authenticationInfo.newCounter,
              backedUp: verification.authenticationInfo.credentialBackedUp,
              deviceType: verification.authenticationInfo.credentialDeviceType,
              lastUsedAt: Date.now(),
            }
          : credential
      ),
    },
    env
  );

  const sessionToken = await issueSessionToken(challenge.email, clientId, env);
  const headers = new Headers(createCorsHeaders(challenge.origin));
  headers.append('Set-Cookie', clearChallengeCookie());
  headers.append(
    'Set-Cookie',
    `session=${sessionToken}; HttpOnly; Secure; SameSite=Lax; Domain=${COOKIE_DOMAIN}; Path=/; Max-Age=${COOKIE_MAX_AGE}`
  );

  return Response.json({ verified: true }, { status: 200, headers });
}

export async function passkeyListCredentials(req: Request, env: Env) {
  const clientId = getClientId(req);
  if (clientId instanceof Response) return clientId;

  const email = await getSessionEmail(req, env, clientId);
  if (email instanceof Response) return email;

  const permission = await getUserPermission(email, env);
  if (!permission || permission.blacklisted || isUserRole(permission)) {
    return createJsonErrorResponse(
      'Forbidden',
      403,
      req.headers.get('origin') || ''
    );
  }

  const rp = getRpContext(req);
  if (rp instanceof Response) return rp;

  const passkeys = (permission.passkeys ?? []).filter(
    (p) => p.rpId === rp.rpId
  );

  return Response.json(
    { credentials: passkeys },
    { status: 200, headers: createCorsHeaders(req.headers.get('origin') || '') }
  );
}

export async function passkeyDeleteCredential(req: Request, env: Env) {
  const clientId = getClientId(req);
  if (clientId instanceof Response) return clientId;

  const email = await getSessionEmail(req, env, clientId);
  if (email instanceof Response) return email;

  const parts = new URL(req.url).pathname.split('/');
  const id = parts[parts.length - 1];
  if (!id) {
    return createJsonErrorResponse(
      'Missing credential id',
      400,
      req.headers.get('origin') || ''
    );
  }

  const permission = await getUserPermission(email, env);
  if (!permission || permission.blacklisted || isUserRole(permission)) {
    return createJsonErrorResponse(
      'Forbidden',
      403,
      req.headers.get('origin') || ''
    );
  }

  const newPasskeys = (permission.passkeys ?? []).filter((p) => p.id !== id);

  await setUserPermission(email, { ...permission, passkeys: newPasskeys }, env);

  return Response.json(
    { success: true },
    { status: 200, headers: createCorsHeaders(req.headers.get('origin') || '') }
  );
}

export async function passkeyUpdateCredential(req: Request, env: Env) {
  const clientId = getClientId(req);
  if (clientId instanceof Response) return clientId;

  const email = await getSessionEmail(req, env, clientId);
  if (email instanceof Response) return email;

  const parts = new URL(req.url).pathname.split('/');
  const id = parts[parts.length - 1];
  if (!id) {
    return createJsonErrorResponse(
      'Missing credential id',
      400,
      req.headers.get('origin') || ''
    );
  }

  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  if (!('name' in body) || typeof body.name !== 'string')
    return createJsonErrorResponse(
      'Missing name',
      400,
      req.headers.get('origin') || ''
    );
  const submitted = body.name;
  const nameTrim = submitted.trim();

  const permission = await getUserPermission(email, env);
  if (!permission || permission.blacklisted || isUserRole(permission)) {
    return createJsonErrorResponse(
      'Forbidden',
      403,
      req.headers.get('origin') || ''
    );
  }

  const passkeys = permission.passkeys ?? [];
  const exists = passkeys.find((p) => p.id === id);
  if (!exists) {
    return createJsonErrorResponse(
      'Not Found',
      404,
      req.headers.get('origin') || ''
    );
  }

  // Determine final name: use provided non-empty name, otherwise generate a unique default like "Passkey N"
  const existingNames = new Set(
    passkeys
      .filter((p) => p.id !== id)
      .map((p) => p.name)
      .filter((n): n is string => typeof n === 'string')
  );

  let finalName: string | undefined;
  if (nameTrim.length > 0) {
    finalName = nameTrim;
    // Check conflict
    const conflict = passkeys.find((p) => p.name === finalName && p.id !== id);
    if (conflict) {
      return Response.json(
        {
          code: 'passkey_name_conflict',
          message: 'Passkey name already in use',
        },
        {
          status: 409,
          headers: createCorsHeaders(req.headers.get('origin') || ''),
        }
      );
    }
  } else {
    const base = 'Passkey';
    let i = 1;
    while (existingNames.has(`${base} ${i}`)) i++;
    finalName = `${base} ${i}`;
  }

  const newPasskeys = passkeys.map((p) =>
    p.id === id
      ? {
          ...p,
          name: finalName,
        }
      : p
  );

  await setUserPermission(email, { ...permission, passkeys: newPasskeys }, env);

  return Response.json(
    { success: true },
    { status: 200, headers: createCorsHeaders(req.headers.get('origin') || '') }
  );
}

export async function passkeyRevoke(req: Request, env: Env) {
  const clientId = getClientId(req);
  if (clientId instanceof Response) return clientId;

  const sessionEmail = await getSessionEmail(req, env, clientId);
  if (sessionEmail instanceof Response) return sessionEmail;

  const sessionPermission = await getUserPermission(sessionEmail, env);
  if (!sessionPermission || !isSuperAdmin(sessionPermission)) {
    return createJsonErrorResponse(
      'Forbidden',
      403,
      req.headers.get('origin') || ''
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    credentialId?: string;
    userId?: string;
  };

  // Revoke by userId: blacklist user
  if (body.userId) {
    const permission = await getUserPermission(body.userId, env);
    if (!permission) {
      return createJsonErrorResponse(
        'Not Found',
        404,
        req.headers.get('origin') || ''
      );
    }
    await setUserPermission(
      body.userId,
      { ...permission, blacklisted: true },
      env
    );
  }

  // Revoke by credentialId: remove credential from any user who has it
  if (body.credentialId) {
    const list = await env.PERMISSIONS.list({ prefix: 'permissions:' });
    for (const key of list.keys) {
      const email = key.name.slice('permissions:'.length);
      const permission = await getUserPermission(email, env);
      if (!permission || !permission.passkeys) continue;
      const newPasskeys = permission.passkeys.filter(
        (p) => p.id !== body.credentialId
      );
      if (newPasskeys.length !== permission.passkeys.length) {
        await setUserPermission(
          email,
          { ...permission, passkeys: newPasskeys },
          env
        );
      }
    }
  }

  return Response.json(
    { success: true },
    { status: 200, headers: createCorsHeaders(req.headers.get('origin') || '') }
  );
}
