import {
  getUserPermission,
  hasOtherSuperAdmin,
  isSuperAdmin,
  isUserRole,
  normalizePermissionPatch,
  setNotificationPreferences,
  setUserPermission,
  type Permission,
} from '@/repositories/permissions.repo';
import { createCorsHeaders, createTextErrorResponse } from '@/http/responses';
import type { Env } from '@/types/env';
import { verifySessionJwt } from '@/services/auth.service';

export async function updatePermissions(req: Request, env: Env) {
  const body: { email: string; permission: Partial<Permission> } =
    await req.json();
  const verifyResponse = await verifySessionJwt(req, env);
  if (!verifyResponse.ok) {
    return verifyResponse;
  }
  if (!body.email || !body.permission) {
    return createTextErrorResponse(
      'Bad Request',
      400,
      req.headers.get('origin') || ''
    );
  }
  const { email: authUserEmail }: { email: string } =
    await verifyResponse.json();
  if (!authUserEmail) {
    return createTextErrorResponse(
      'Unauthorized',
      401,
      req.headers.get('origin') || ''
    );
  }
  const authUserPermission = await getUserPermission(authUserEmail, env);
  if (authUserPermission?.blacklisted) {
    return createTextErrorResponse(
      'Forbidden',
      403,
      req.headers.get('origin') || ''
    );
  }
  if (!isSuperAdmin(authUserPermission)) {
    return createTextErrorResponse(
      'Forbidden',
      403,
      req.headers.get('origin') || ''
    );
  }
  const { email, permission } = body;
  const existingPermission = await getUserPermission(email, env);
  if (!existingPermission) {
    return createTextErrorResponse(
      'User not found',
      404,
      req.headers.get('origin') || ''
    );
  }
  let normalizedPermissionPatch: Partial<Permission>;
  try {
    normalizedPermissionPatch = normalizePermissionPatch(permission);
  } catch (error) {
    const message =
      error instanceof Error && error.message === 'Invalid accessLevel'
        ? 'Invalid access level'
        : 'Invalid role';
    return createTextErrorResponse(
      message,
      400,
      req.headers.get('origin') || ''
    );
  }

  const updatedPermission: Permission = {
    ...existingPermission,
    ...normalizedPermissionPatch,
  };

  const isSelfUpdate = authUserEmail.toLowerCase() === email.toLowerCase();
  if (isSelfUpdate) {
    if (updatedPermission.blacklisted) {
      return createTextErrorResponse(
        'Cannot blacklist your own account',
        409,
        req.headers.get('origin') || ''
      );
    }

    if (!isSuperAdmin(updatedPermission)) {
      return createTextErrorResponse(
        'Cannot remove your own super-admin role',
        409,
        req.headers.get('origin') || ''
      );
    }
  }

  if (
    isSuperAdmin(existingPermission) &&
    !isSuperAdmin(updatedPermission) &&
    !(await hasOtherSuperAdmin(email, env))
  ) {
    return createTextErrorResponse(
      'Cannot remove the last super-admin account',
      409,
      req.headers.get('origin') || ''
    );
  }
  try {
    await setUserPermission(email, updatedPermission, env);
  } catch (error) {
    console.error('Error updating permission:', error);
    return createTextErrorResponse(
      'Internal Server Error',
      500,
      req.headers.get('origin') || ''
    );
  }
  return new Response('Permission updated', {
    status: 200,
    headers: createCorsHeaders(req.headers.get('origin') || ''),
  });
}

interface NotificationsPreference {
  email: boolean;
  push: boolean;
}

export async function updateMyNotificationsPreference(req: Request, env: Env) {
  const body: { notifications: NotificationsPreference } = await req.json();
  const verifyResponse = await verifySessionJwt(req, env);
  if (!verifyResponse.ok) {
    return verifyResponse;
  }
  const { email }: { email: string } = await verifyResponse.json();
  if (!email) {
    return createTextErrorResponse(
      'Unauthorized',
      401,
      req.headers.get('origin') || ''
    );
  }
  const existingPermission = await getUserPermission(email, env);
  if (!existingPermission) {
    return createTextErrorResponse(
      'User not found',
      404,
      req.headers.get('origin') || ''
    );
  }
  if (existingPermission.blacklisted) {
    return createTextErrorResponse(
      'Forbidden',
      403,
      req.headers.get('origin') || ''
    );
  }
  if (isUserRole(existingPermission)) {
    return createTextErrorResponse(
      'Forbidden',
      403,
      req.headers.get('origin') || ''
    );
  }
  const notifications = {
    email:
      body.notifications.email ??
      existingPermission.notifications?.email ??
      false,
    push:
      body.notifications.push ??
      existingPermission.notifications?.push ??
      false,
  };

  try {
    await setNotificationPreferences(email, notifications, env);
  } catch (error) {
    console.error('Error updating permission:', error);
    return createTextErrorResponse(
      'Internal Server Error',
      500,
      req.headers.get('origin') || ''
    );
  }
  return new Response('Permission updated', {
    status: 200,
    headers: createCorsHeaders(req.headers.get('origin') || ''),
  });
}

export async function removeMyGithubOAuthPermission(req: Request, env: Env) {
  const origin = req.headers.get('origin') || '';

  const verifyResponse = await verifySessionJwt(req, env);
  if (!verifyResponse.ok) {
    return verifyResponse;
  }

  const { email }: { email: string } = await verifyResponse.json();
  if (!email) {
    return createTextErrorResponse('Unauthorized', 401, origin);
  }

  const existingPermission = await getUserPermission(email, env);
  if (!existingPermission) {
    return createTextErrorResponse('User not found', 404, origin);
  }

  if (existingPermission.blacklisted) {
    return createTextErrorResponse('Forbidden', 403, origin);
  }

  if (isUserRole(existingPermission)) {
    return createTextErrorResponse('Forbidden', 403, origin);
  }

  const updatedPermission: Permission = {
    ...existingPermission,
    oAuthProviders: {
      ...existingPermission.oAuthProviders,
      github: false,
    },
  };
  delete updatedPermission.githubUserID;

  try {
    await setUserPermission(email, updatedPermission, env);
  } catch (error) {
    console.error('Error removing GitHub OAuth permission:', error);
    return createTextErrorResponse('Internal Server Error', 500, origin);
  }

  return new Response('GitHub OAuth removed', {
    status: 200,
    headers: createCorsHeaders(origin),
  });
}
