import { jwtVerify, SignJWT } from 'jose';

import {
  getUserPermission,
  setGithubUserID,
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
 * Types
 */

type GithubEmail = {
  email: string;
  verified: boolean;
  primary: boolean;
  visibility: string | null;
};

type StatePayload = {
  csrf: string;
  clientId: string;
};

/**
 * Redirect user to GitHub login
 */
export async function startGitHubOAuth(req: Request, env: Env) {
  const url = new URL(req.url);
  const redirectUri = url.searchParams.get('redirect_uri');

  if (!redirectUri) {
    return new Response('Missing redirect_uri', { status: 400 });
  }

  const errorRedirectUri = new URL(redirectUri);

  const clientId = url.searchParams.get('client_id');

  if (!clientId) {
    errorRedirectUri.searchParams.set('error', 'missing_client_id');
    return new Response(null, {
      status: 302,
      headers: { Location: errorRedirectUri.toString() },
    });
  }

  if (!ALLOWED_CLIENTS[clientId]) {
    errorRedirectUri.searchParams.set('error', 'invalid_client_id');
    return new Response(null, {
      status: 302,
      headers: { Location: errorRedirectUri.toString() },
    });
  }

  const csrf = crypto.randomUUID();

  const statePayload: StatePayload = {
    csrf,
    clientId,
  };

  const signedStatePayload = await new SignJWT(statePayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(JWT_EXPIRATION_TIME)
    .setJti(crypto.randomUUID())
    .sign(new TextEncoder().encode(env.JWT_SECRET));

  const githubUrl = new URL('https://github.com/login/oauth/authorize');

  githubUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  githubUrl.searchParams.set('redirect_uri', env.GITHUB_REDIRECT_URI);
  githubUrl.searchParams.set('scope', 'read:user,user:email');
  githubUrl.searchParams.set('state', csrf);

  return new Response(null, {
    status: 302,
    headers: {
      'Set-Cookie': `oauth_state=${signedStatePayload}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${COOKIE_MAX_AGE}`,
      Location: githubUrl.toString(),
    },
  });
}

/**
 * Handle GitHub OAuth callback
 */
export async function completeGitHubOAuth(req: Request, env: Env) {
  const url = new URL(req.url);

  const stateFromGithub = url.searchParams.get('state');
  const code = url.searchParams.get('code');

  const stored = parseCookies(req.headers.get('Cookie') || '').oauth_state;

  if (!stored) {
    return new Response('Missing state', { status: 400 });
  }

  let statePayload: StatePayload;
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

    statePayload = { csrf: payload.csrf, clientId: payload.clientId };
  } catch {
    return new Response('Invalid or expired state', { status: 403 });
  }

  if (!code) {
    return redirectError(statePayload.clientId, 'missing_code');
  }

  if (stateFromGithub !== statePayload.csrf) {
    return redirectError(statePayload.clientId, 'invalid_state');
  }

  /**
   * Exchange code → access token
   */
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  if (!tokenRes.ok) {
    return redirectError(statePayload.clientId, 'token_exchange_failed');
  }

  const tokenData: { access_token?: string } = await tokenRes.json();

  if (!tokenData.access_token) {
    return redirectError(statePayload.clientId, 'invalid_github_token');
  }

  /**
   * Fetch GitHub user
   */
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `token ${tokenData.access_token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'api.scs.pdn.ac.lk',
    },
  });

  if (!userRes.ok) {
    return redirectError(statePayload.clientId, 'github_user_fetch_failed');
  }

  const github: {
    id: number;
    login: string;
    name: string | null;
    avatar_url: string;
  } = await userRes.json();

  const name = github.name ? github.name : github.login;
  const picture = github.avatar_url;

  /**
   * Fetch GitHub emails
   */
  const emailRes = await fetch('https://api.github.com/user/emails', {
    headers: {
      Authorization: `token ${tokenData.access_token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'api.scs.pdn.ac.lk',
    },
  });

  if (!emailRes.ok) {
    return redirectError(statePayload.clientId, 'github_email_fetch_failed');
  }

  const emails: GithubEmail[] = await emailRes.json();

  /**
   * Filter verified university emails
   */
  const validEmails = emails.filter((e) => {
    if (!e.verified) return false;

    if (e.email.endsWith('users.noreply.github.com')) return false;

    const domain = e.email.split('@')[1];
    if (!domain) return false;

    return ALLOWED_GOOGLE_WORKSPACES_DOMAINS.includes(domain);
  });

  if (validEmails.length === 0) {
    return redirectError(statePayload.clientId, 'no_valid_email');
  }

  if (validEmails.length > 1) {
    return redirectError(statePayload.clientId, 'multiple_valid_emails');
  }

  const email = validEmails[0].email;

  /**
   * Permission check
   */
  const permission = await getUserPermission(email, env);

  if (!permission) {
    return redirectError(statePayload.clientId, 'google_account_required');
  }

  if (permission.blacklisted) {
    return redirectError(statePayload.clientId, 'user_blacklisted');
  }

  /**
   * First GitHub login → link account
   */
  if (!permission.githubUserID) {
    await setGithubUserID(email, github.id, env);
  } else if (permission.githubUserID !== github.id) {
    return redirectError(statePayload.clientId, 'github_account_mismatch');
  }

  /**
   * Issue session JWT
   */
  const { name: safeName, picture: safePicture } = sanitizeProfile(
    name,
    picture
  );

  const loginReq = new Request(req.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name: safeName, picture: safePicture }),
  });

  const loginRes = await issueSessionJwt(
    loginReq,
    env,
    statePayload.clientId,
    'github'
  );

  if (!loginRes.ok) {
    return redirectError(statePayload.clientId, 'failed_to_create_session');
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
