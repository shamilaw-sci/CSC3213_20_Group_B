import {
  getUserPermission,
  isSuperAdmin,
} from '@/repositories/permissions.repo';
import {
  createCorsHeaders,
  createJsonErrorResponse,
  createTextErrorResponse,
} from '@/http/responses';
import type { Env } from '@/types/env';
import { verifySessionJwt } from '@/services/auth.service';

type AdminActionDefinition = {
  id: string;
  title: string;
  description: string;
  method: 'POST';
  href: string;
  danger: boolean;
  confirmation: string;
  requestSchema: Record<string, unknown>;
  resultSchema: Record<string, unknown>;
};

const ADMIN_ACTIONS: AdminActionDefinition[] = [];

async function requireSuperAdminSession(
  req: Request,
  env: Env
): Promise<{ email: string } | Response> {
  const origin = req.headers.get('origin') || '';
  const verifyResponse = await verifySessionJwt(req, env);
  if (!verifyResponse.ok) {
    return verifyResponse;
  }

  const { email }: { email?: string } = await verifyResponse.json();
  if (!email) {
    return createTextErrorResponse('Unauthorized', 401, origin);
  }

  const permission = await getUserPermission(email, env);
  if (!permission || permission.blacklisted || !isSuperAdmin(permission)) {
    return createTextErrorResponse('Forbidden', 403, origin);
  }

  return { email };
}

export async function listAdminActions(
  req: Request,
  env: Env
): Promise<Response> {
  const session = await requireSuperAdminSession(req, env);
  if (session instanceof Response) return session;

  return Response.json(
    {
      schemaVersion: 1,
      actions: ADMIN_ACTIONS,
    },
    { headers: createCorsHeaders(req.headers.get('origin') || '') }
  );
}

export async function runAdminAction(
  req: Request,
  env: Env
): Promise<Response> {
  const session = await requireSuperAdminSession(req, env);
  if (session instanceof Response) return session;

  const origin = req.headers.get('origin') || '';
  const actionId = decodeURIComponent(
    new URL(req.url).pathname.slice('/api/admin/actions/'.length)
  );

  void actionId;

  return createJsonErrorResponse('Action not found', 404, origin);
}
