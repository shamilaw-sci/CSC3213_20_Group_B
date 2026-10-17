import {
  deleteUserPermission,
  getAllUserData,
  getUserPermission,
  hasOtherSuperAdmin,
  isSuperAdmin,
  normalizePermissionPatch,
  setUserPermission,
  type Permission,
  type UserData,
} from '@/repositories/permissions.repo';
import {
  createCorsHeaders,
  createJsonErrorResponse,
  createTextErrorResponse,
} from '@/http/responses';
import type { Env } from '@/types/env';
import { verifySessionJwt } from '@/services/auth.service';
import { resolveProfilePictureUpdate } from '@/utils/profile-picture';

/**
 * GET /api/admin/users
 *
 * Returns all registered users. Requires a valid session belonging to a
 * non-blacklisted super-admin.
 */
export async function listUsers(req: Request, env: Env): Promise<Response> {
  const origin = req.headers.get('origin') || '';

  const verifyResponse = await verifySessionJwt(req, env);
  if (!verifyResponse.ok) {
    return verifyResponse;
  }

  const { email: authUserEmail }: { email: string } =
    await verifyResponse.json();
  if (!authUserEmail) {
    return createTextErrorResponse('Unauthorized', 401, origin);
  }

  const authUserPermission = await getUserPermission(authUserEmail, env);
  if (!authUserPermission || authUserPermission.blacklisted) {
    return createTextErrorResponse('Forbidden', 403, origin);
  }

  if (!isSuperAdmin(authUserPermission)) {
    return createTextErrorResponse('Forbidden', 403, origin);
  }

  let users: UserData[];
  try {
    users = await getAllUserData(env);
  } catch (error) {
    console.error('Error fetching user data:', error);
    return createTextErrorResponse('Internal Server Error', 500, origin);
  }

  return Response.json(users, {
    headers: createCorsHeaders(origin),
  });
}

/**
 * GET /api/admin/users/:email
 *
 * Returns the permissions for a single user identified by email.
 * Requires a valid session belonging to a non-blacklisted super-admin.
 */
export async function getUserPermissions(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = req.headers.get('origin') || '';

  const verifyResponse = await verifySessionJwt(req, env);
  if (!verifyResponse.ok) {
    return verifyResponse;
  }

  const { email: authUserEmail }: { email: string } =
    await verifyResponse.json();
  if (!authUserEmail) {
    return createTextErrorResponse('Unauthorized', 401, origin);
  }

  const authUserPermission = await getUserPermission(authUserEmail, env);
  if (!authUserPermission || authUserPermission.blacklisted) {
    return createTextErrorResponse('Forbidden', 403, origin);
  }

  if (!isSuperAdmin(authUserPermission)) {
    return createTextErrorResponse('Forbidden', 403, origin);
  }

  const url = new URL(req.url);
  const email = decodeURIComponent(
    url.pathname.slice('/api/admin/users/'.length)
  );

  if (!email) {
    return createJsonErrorResponse('Email required', 400, origin);
  }

  const permission = await getUserPermission(email, env);
  if (!permission) {
    return createJsonErrorResponse('User not found', 404, origin);
  }

  return Response.json(permission, {
    headers: createCorsHeaders(origin),
  });
}

/**
 * PATCH /api/admin/users/:email
 *
 * Updates permissions for a single user identified by email.
 * Requires a valid session belonging to a non-blacklisted super-admin.
 */
export async function updateUserPermissions(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = req.headers.get('origin') || '';

  const verifyResponse = await verifySessionJwt(req, env);
  if (!verifyResponse.ok) {
    return verifyResponse;
  }

  const { email: authUserEmail }: { email: string } =
    await verifyResponse.json();
  if (!authUserEmail) {
    return createTextErrorResponse('Unauthorized', 401, origin);
  }

  const authUserPermission = await getUserPermission(authUserEmail, env);
  if (!authUserPermission || authUserPermission.blacklisted) {
    return createTextErrorResponse('Forbidden', 403, origin);
  }

  if (!isSuperAdmin(authUserPermission)) {
    return createTextErrorResponse('Forbidden', 403, origin);
  }

  const url = new URL(req.url);
  const email = decodeURIComponent(
    url.pathname.slice('/api/admin/users/'.length)
  );

  if (!email) {
    return createJsonErrorResponse('Email required', 400, origin);
  }

  const existingPermission = await getUserPermission(email, env);
  if (!existingPermission) {
    return createJsonErrorResponse('User not found', 404, origin);
  }

  let patch: Partial<Permission>;
  try {
    patch = await req.json();
  } catch {
    return createJsonErrorResponse('Invalid JSON body', 400, origin);
  }

  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return createJsonErrorResponse(
      'Request body must be a JSON object',
      400,
      origin
    );
  }

  let normalizedPatch: Partial<Permission>;
  try {
    normalizedPatch = normalizePermissionPatch(patch);
  } catch (error) {
    const message =
      error instanceof Error && error.message === 'Invalid pictureMode'
        ? 'Invalid picture mode'
        : error instanceof Error && error.message === 'Invalid accessLevel'
          ? 'Invalid access level'
          : 'Invalid role';
    return createJsonErrorResponse(message, 400, origin);
  }

  if ('pictureMode' in patch || 'picture' in patch || 'gravatarMail' in patch) {
    const resolvedPicture = await resolveProfilePictureUpdate(
      {
        pictureMode: patch.pictureMode,
        picture: patch.picture,
        gravatarMail: patch.gravatarMail,
      },
      existingPermission,
      email
    );
    if (!resolvedPicture.ok) {
      return createJsonErrorResponse(resolvedPicture.message, 400, origin);
    }

    normalizedPatch = {
      ...normalizedPatch,
      ...resolvedPicture.patch,
    };
  }

  const updatedPermission: Permission = {
    ...existingPermission,
    ...normalizedPatch,
  };

  const isSelfUpdate = authUserEmail.toLowerCase() === email.toLowerCase();
  if (isSelfUpdate) {
    if (updatedPermission.blacklisted) {
      return createJsonErrorResponse(
        'Cannot blacklist your own account',
        409,
        origin
      );
    }

    if (!isSuperAdmin(updatedPermission)) {
      return createJsonErrorResponse(
        'Cannot remove your own super-admin role',
        409,
        origin
      );
    }
  }

  if (
    isSuperAdmin(existingPermission) &&
    !isSuperAdmin(updatedPermission) &&
    !(await hasOtherSuperAdmin(email, env))
  ) {
    return createJsonErrorResponse(
      'Cannot remove the last super-admin account',
      409,
      origin
    );
  }

  try {
    await setUserPermission(email, updatedPermission, env);
  } catch (error) {
    console.error('Error updating permission:', error);
    return createTextErrorResponse('Internal Server Error', 500, origin);
  }

  return Response.json(updatedPermission, {
    headers: createCorsHeaders(origin),
  });
}

/**
 * DELETE /api/admin/users/:email
 *
 * Deletes the permission record for a single user identified by email.
 * Requires a valid session belonging to a non-blacklisted super-admin.
 */
export async function deleteUserPermissions(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = req.headers.get('origin') || '';

  const verifyResponse = await verifySessionJwt(req, env);
  if (!verifyResponse.ok) {
    return verifyResponse;
  }

  const { email: authUserEmail }: { email: string } =
    await verifyResponse.json();
  if (!authUserEmail) {
    return createTextErrorResponse('Unauthorized', 401, origin);
  }

  const authUserPermission = await getUserPermission(authUserEmail, env);
  if (!authUserPermission || authUserPermission.blacklisted) {
    return createTextErrorResponse('Forbidden', 403, origin);
  }

  if (!isSuperAdmin(authUserPermission)) {
    return createTextErrorResponse('Forbidden', 403, origin);
  }

  const url = new URL(req.url);
  const email = decodeURIComponent(
    url.pathname.slice('/api/admin/users/'.length)
  );

  if (!email) {
    return createJsonErrorResponse('Email required', 400, origin);
  }

  const existingPermission = await getUserPermission(email, env);
  if (!existingPermission) {
    return createJsonErrorResponse('User not found', 404, origin);
  }

  if (authUserEmail.toLowerCase() === email.toLowerCase()) {
    return createJsonErrorResponse(
      'Cannot delete your own account',
      409,
      origin
    );
  }

  if (
    isSuperAdmin(existingPermission) &&
    !(await hasOtherSuperAdmin(email, env))
  ) {
    return createJsonErrorResponse(
      'Cannot delete the last super-admin account',
      409,
      origin
    );
  }

  try {
    await deleteUserPermission(email, env);
  } catch (error) {
    console.error('Error deleting permission:', error);
    return createTextErrorResponse('Internal Server Error', 500, origin);
  }

  return new Response(null, {
    status: 204,
    headers: createCorsHeaders(origin),
  });
}
