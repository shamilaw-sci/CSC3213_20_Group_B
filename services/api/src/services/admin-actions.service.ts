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
import { verifySessionRequest } from '@/middleware/session';
import { migrateLegacyAuth } from '@/services/legacy-auth-migration.service';

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

const LEGACY_AUTH_MIGRATION_CONFIRMATION =
  'Migrate legacy GitHub identities and passkeys into Better Auth.';

const ADMIN_ACTIONS: AdminActionDefinition[] = [
  {
    id: 'migrate-legacy-auth',
    title: 'Migrate legacy authentication',
    description:
      'Idempotently backfill legacy GitHub identities and WebAuthn credentials into Better Auth D1 tables.',
    method: 'POST',
    href: '/api/admin/actions/migrate-legacy-auth',
    danger: true,
    confirmation: LEGACY_AUTH_MIGRATION_CONFIRMATION,
    requestSchema: {
      type: 'object',
      required: ['confirmation'],
      properties: { confirmation: { type: 'string' } },
      additionalProperties: false,
    },
    resultSchema: {
      type: 'object',
      properties: {
        scanned: { type: 'integer' },
        usersCreated: { type: 'integer' },
        githubAccountsCreated: { type: 'integer' },
        passkeysCreated: { type: 'integer' },
        permissionsCleaned: { type: 'integer' },
        skipped: { type: 'integer' },
        conflicts: { type: 'array', items: { type: 'string' } },
      },
    },
  },
];

async function requireSuperAdminSession(
  req: Request,
  env: Env
): Promise<{ email: string } | Response> {
  const origin = req.headers.get('origin') || '';
  const verifyResponse = await verifySessionRequest(req, env);
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

  if (actionId === 'migrate-legacy-auth') {
    const body = (await req.json().catch(() => ({}))) as {
      confirmation?: unknown;
    };
    if (body.confirmation !== LEGACY_AUTH_MIGRATION_CONFIRMATION) {
      return createJsonErrorResponse('Confirmation required', 400, origin);
    }
    const result = await migrateLegacyAuth(env);
    return Response.json(result, {
      headers: createCorsHeaders(origin),
    });
  }

  return createJsonErrorResponse('Action not found', 404, origin);
}
