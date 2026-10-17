import { jwtVerify, createRemoteJWKSet, SignJWT } from 'jose';

import {
  defaultRoleForEmail,
  getUserPermission,
  setUserPermission,
} from '@/repositories/permissions.repo';
import {
  ALLOWED_CLIENTS,
  ALLOWED_GOOGLE_WORKSPACES_DOMAINS,
  COOKIE_DOMAIN,
  COOKIE_MAX_AGE,
  JWT_EXPIRATION_TIME,
  REDIRECT_URLS,
} from '@/config/client.config';
import { parseCookies } from '@/utils/cookies';
import { redirectError } from '@/utils/oauth-redirect';
import { sanitizeProfile } from '@/utils/profile';
import type { Env } from '@/types/env';
import { issueSessionJwt } from '@/services/auth.service';

/**
 * Google's public keys for verifying ID tokens
 */
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs')
);

/**
 * Redirect user to Google login
 */
export async function startGoogleOAuth(req: Request, env: Env) {
  const url = new URL(req.url);

  const clientId = url.searchParams.get('client_id');
  if (!clientId) {
    return new Response('Missing client_id', { status: 400 });
  }

  if (!ALLOWED_CLIENTS[clientId]) {
    return new Response('Invalid client_id', { status: 400 });
  }

  const isSignup = url.searchParams.get('signup') === 'true';

  const csrf = crypto.randomUUID();
  const statePayload = { csrf, clientId, isSignup };
  const signedStatePayload = await new SignJWT(statePayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(JWT_EXPIRATION_TIME)
    .setJti(crypto.randomUUID())
    .sign(new TextEncoder().encode(env.JWT_SECRET));

  const googleUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');

  googleUrl.searchParams.set('state', csrf);

  googleUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);

  googleUrl.searchParams.set('redirect_uri', env.GOOGLE_REDIRECT_URI);

  googleUrl.searchParams.set('response_type', 'code');

  googleUrl.searchParams.set('scope', 'openid email profile');

  const isPromptSelectAccount =
    url.searchParams.get('prompt') === 'select_account';
  if (isPromptSelectAccount) {
    googleUrl.searchParams.set('prompt', 'select_account');
  }

  return new Response(null, {
    status: 302,
    headers: {
      'Set-Cookie': `oauth_state=${signedStatePayload}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${COOKIE_MAX_AGE}`,
      Location: googleUrl.toString(),
    },
  });
}

/**
 * Handle Google OAuth callback
 */
export async function completeGoogleOAuth(req: Request, env: Env) {
  const url = new URL(req.url);

  const cookieHeader = req.headers.get('Cookie') || '';
  const stored = parseCookies(cookieHeader).oauth_state;

  if (!stored) {
    return new Response('Missing state', { status: 400 });
  }

  let statePayload: { csrf: string; clientId: string; isSignup?: boolean };
  try {
    const { payload } = await jwtVerify(
      stored,
      new TextEncoder().encode(env.JWT_SECRET)
    );

    if (
      typeof payload.csrf !== 'string' ||
      typeof payload.clientId !== 'string'
    ) {
      return new Response('Invalid state payload', { status: 403 });
    }

    statePayload = payload as typeof statePayload;
  } catch {
    return new Response('Invalid or expired state', { status: 403 });
  }

  /**
   * Handle OAuth cancellation from Google
   */
  const oauthError = url.searchParams.get('error');

  if (oauthError) {
    return redirectError(statePayload.clientId, 'google_access_denied');
  }

  const stateFromGoogle = url.searchParams.get('state');

  if (stateFromGoogle !== statePayload.csrf) {
    return redirectError(statePayload.clientId, 'invalid_state');
  }

  const code = url.searchParams.get('code');

  if (!code) {
    return redirectError(statePayload.clientId, 'missing_code');
  }

  /**
   * Exchange code for tokens
   */
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: env.GOOGLE_REDIRECT_URI,
    }),
  });

  if (!tokenRes.ok) {
    return redirectError(statePayload.clientId, 'token_exchange_failed');
  }

  const tokenData: {
    access_token: string;
    id_token: string;
  } = await tokenRes.json();

  /**
   * Verify Google ID token
   */
  let googlePayload: {
    email: string;
    email_verified: boolean;
    name?: string;
    picture?: string;
    sub: string;
    hd?: string;
  };
  try {
    ({ payload: googlePayload } = await jwtVerify(
      tokenData.id_token,
      GOOGLE_JWKS,
      {
        issuer: 'https://accounts.google.com',
        audience: env.GOOGLE_CLIENT_ID,
      }
    ));
  } catch (error) {
    console.error('ID token verification failed:', error);
    return redirectError(statePayload.clientId, 'invalid_id_token');
  }

  const email = googlePayload.email.trim().toLowerCase();
  const emailVerified = googlePayload.email_verified;
  const name = googlePayload.name;
  const picture = googlePayload.picture;
  // const googleId = googlePayload.sub;

  /**
   * This is only present for Google Workspace accounts and sometimes this can be empty even for valid accounts,
   * so we won't enforce this claim for now
   */
  // const hostedDomain = googlePayload.hd;

  if (!email || !emailVerified) {
    return redirectError(statePayload.clientId, 'invalid_google_account');
  }

  /**
   * Restrict to allowed domains
   */
  const emailDomain = email.split('@')[1];
  if (!ALLOWED_GOOGLE_WORKSPACES_DOMAINS.includes(emailDomain)) {
    return redirectError(statePayload.clientId, 'workspace_account_required');
  }

  /**
   * Check permission system
   */
  let permission = await getUserPermission(email, env);
  const isSignup = statePayload.isSignup === true;
  const { name: safeName, picture: safePicture } = sanitizeProfile(
    name,
    picture
  );
  if (isSignup) {
    if (permission) {
      return redirectError(statePayload.clientId, 'user_already_exists');
    }

    await setUserPermission(
      email,
      {
        role: defaultRoleForEmail(email),
        oAuthProviders: { google: true },
        name: safeName,
        picture: safePicture,
        pictureMode: 'google',
        createdAt: Date.now(),
      },
      env
    );

    permission = await getUserPermission(email, env);
  } else {
    if (!permission) {
      return redirectError(statePayload.clientId, 'user_not_registered');
    }
  }

  if (permission?.blacklisted) {
    return redirectError(statePayload.clientId, 'user_blacklisted');
  }

  if (!permission?.oAuthProviders?.google) {
    return redirectError(statePayload.clientId, 'google_oauth_not_allowed');
  }

  /**
   * Issue your own JWT
   */
  const loginReq = new Request(req.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, name: safeName, picture: safePicture }),
  });
  const loginRes = await issueSessionJwt(
    loginReq,
    env,
    statePayload.clientId,
    'google'
  );
  if (!loginRes.ok) {
    return redirectError(statePayload.clientId, 'session_creation_failed');
  }
  const loginData: { token: string } = await loginRes.json();

  const headers = new Headers();

  headers.set('Location', REDIRECT_URLS[statePayload.clientId]);

  headers.append(
    'Set-Cookie',
    `session=${loginData.token}; HttpOnly; Secure; SameSite=Lax; Domain=${COOKIE_DOMAIN}; Path=/; Max-Age=${COOKIE_MAX_AGE}`
  );

  headers.append(
    'Set-Cookie',
    `oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
  );

  return new Response(null, {
    status: 302,
    headers,
  });
}
