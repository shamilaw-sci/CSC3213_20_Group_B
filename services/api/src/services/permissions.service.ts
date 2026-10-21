import {
  getUserPermission,
  isUserRole,
  setNotificationPreferences,
} from '@/repositories/permissions.repo';
import { createCorsHeaders, createTextErrorResponse } from '@/http/responses';
import type { Env } from '@/types/env';
import { verifySessionRequest } from '@/middleware/session';

interface NotificationsPreference {
  email: boolean;
  push: boolean;
}

export async function updateMyNotificationsPreference(req: Request, env: Env) {
  const body: { notifications: NotificationsPreference } = await req.json();
  const verifyResponse = await verifySessionRequest(req, env);
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
