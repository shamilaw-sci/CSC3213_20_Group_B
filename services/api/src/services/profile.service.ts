import type { Env } from '@/types/env';
import { hasSessionCookie, verifyIdentitySession } from '@/middleware/session';
import {
  getPermissionAccessLevel,
  getPermissionRole,
  getUserPermission,
  isUserRole,
  setUserPermission,
} from '@/repositories/permissions.repo';
import {
  createCorsHeaders,
  createJsonErrorResponse,
  createTextErrorResponse,
} from '@/http/responses';
import { PROFILE_NAME_MAX_LENGTH } from '@/config/client.config';
import { resolveProfilePictureUpdate } from '@/utils/profile-picture';
import { getAuthIdentityByEmail } from '@/repositories/auth-accounts.repo';

async function getVerifiedProfile(
  req: Request,
  env: Env
): Promise<
  | {
      ok: true;
      email: string;
      name?: string;
      picture?: string;
    }
  | { ok: false; response: Response }
> {
  const origin = req.headers.get('origin') || '';

  if (!hasSessionCookie(req)) {
    return {
      ok: false,
      response: createTextErrorResponse('Unauthorized', 401, origin),
    };
  }

  const clientId = req.headers.get('X-Client-Id');
  if (!clientId) {
    return {
      ok: false,
      response: createTextErrorResponse(
        'Missing X-Client-Id header',
        400,
        origin
      ),
    };
  }

  const payload = await verifyIdentitySession(req, env, clientId);
  if (payload instanceof Response) {
    return {
      ok: false,
      response: payload,
    };
  }

  return {
    ok: true,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  };
}

export async function me(req: Request, env: Env): Promise<Response> {
  const verified = await getVerifiedProfile(req, env);
  if (!verified.ok) {
    return verified.response;
  }

  const permission = await getUserPermission(verified.email, env);

  if (!permission) {
    return createTextErrorResponse(
      'User not found',
      404,
      req.headers.get('origin') || ''
    );
  }
  const authIdentity = await getAuthIdentityByEmail(verified.email, env);

  const profileData = {
    email: verified.email,
    name: permission.name ?? verified.name,
    picture: permission.picture ?? verified.picture,
    role: getPermissionRole(permission),
    accessLevel: getPermissionAccessLevel(permission),
    ...(permission.honoursDepartments?.length
      ? { honoursDepartments: permission.honoursDepartments }
      : {}),
    blacklisted: permission.blacklisted || false,
    googleOAuth: authIdentity?.providers.has('google') ?? false,
    githubOAuth: authIdentity?.providers.has('github') ?? false,
    githubUserID: authIdentity?.githubUserId ?? null,
    pictureMode: permission.pictureMode ?? null,
    gravatarMail: permission.gravatarMail ?? null,
    isEmailNotificationEnabled: permission.notifications?.email || false,
    isPushNotificationEnabled: permission.notifications?.push || false,
  };

  return Response.json(profileData, {
    headers: createCorsHeaders(req.headers.get('origin') || ''),
  });
}

export async function updateMe(req: Request, env: Env): Promise<Response> {
  const origin = req.headers.get('origin') || '';
  const verified = await getVerifiedProfile(req, env);
  if (!verified.ok) {
    return verified.response;
  }

  const permission = await getUserPermission(verified.email, env);
  if (!permission) {
    return createJsonErrorResponse('User not found', 404, origin);
  }

  if (permission.blacklisted) {
    return createTextErrorResponse('Forbidden', 403, origin);
  }

  if (isUserRole(permission)) {
    return createTextErrorResponse('Forbidden', 403, origin);
  }

  const authIdentity = await getAuthIdentityByEmail(verified.email, env);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createJsonErrorResponse('Invalid JSON body', 400, origin);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return createJsonErrorResponse(
      'Request body must be a JSON object',
      400,
      origin
    );
  }

  const { name, pictureMode, picture, gravatarMail } = body as {
    name?: unknown;
    pictureMode?: unknown;
    picture?: unknown;
    gravatarMail?: unknown;
  };
  if (typeof name !== 'string') {
    return createJsonErrorResponse('Name must be a string', 400, origin);
  }

  let picturePatch = {};
  if (pictureMode !== undefined) {
    const resolvedPicture = await resolveProfilePictureUpdate(
      { pictureMode, picture, gravatarMail },
      permission,
      verified.email,
      {
        googleConnected: authIdentity?.providers.has('google') ?? false,
        githubUserId: authIdentity?.githubUserId,
        providerPicture: authIdentity?.image,
      }
    );
    if (!resolvedPicture.ok) {
      return createJsonErrorResponse(resolvedPicture.message, 400, origin);
    }

    picturePatch = resolvedPicture.patch;
  }

  const updatedPermission = {
    ...permission,
    name: name.trim().slice(0, PROFILE_NAME_MAX_LENGTH),
    ...picturePatch,
  };

  try {
    await setUserPermission(verified.email, updatedPermission, env);
  } catch (error) {
    console.error('Error updating profile:', error);
    return createTextErrorResponse('Internal Server Error', 500, origin);
  }

  return Response.json(
    {
      name: updatedPermission.name,
      picture: updatedPermission.picture,
      pictureMode: updatedPermission.pictureMode ?? null,
      gravatarMail: updatedPermission.gravatarMail ?? null,
    },
    {
      headers: createCorsHeaders(origin),
    }
  );
}
