import { interpretJevSuggestion, validateRoleAssignment } from '@scs/identity';
import {
  IdentityAccountsQuerySchema,
  IdentityDecisionRequestSchema,
} from '@scs/schemas';
import { z } from 'zod';

import {
  createJsonErrorResponse,
  createJsonResponse,
  getRequestOrigin,
} from '@/http/responses';
import { verifySessionRequest } from '@/middleware/session';
import { getAuthIdentityByEmail } from '@/repositories/auth-accounts.repo';
import {
  getIdentityHistory,
  listIdentityAccounts,
  saveIdentityDecision,
} from '@/repositories/identity.repo';
import { isIdentityMigrationMissing } from '@/repositories/migration-error';
import {
  getUserPermission,
  isSuperAdmin,
} from '@/repositories/permissions.repo';
import type { Env } from '@/types/env';
import { isAllowedEmailDomain } from '@/utils/email-domains';

async function authorizedAdmin(req: Request, env: Env): Promise<string | null> {
  const response = await verifySessionRequest(req, env);
  if (!response.ok) return null;
  const user: { email?: string } = await response.json();
  if (!user.email) return null;
  const permission = await getUserPermission(user.email, env);
  return permission && !permission.blacklisted && isSuperAdmin(permission)
    ? user.email.toLowerCase()
    : null;
}

export async function listAdminIdentity(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  if (!(await authorizedAdmin(req, env))) {
    return createJsonErrorResponse('Super admin access required', 403, origin);
  }
  const url = new URL(req.url);
  const parsed = IdentityAccountsQuerySchema.safeParse({
    query: url.searchParams.get('query') ?? undefined,
    cursor: url.searchParams.get('cursor') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    role: url.searchParams.get('role') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    verified: url.searchParams.get('verified') ?? undefined,
  });
  if (
    !parsed.success ||
    (parsed.data.cursor && !isAllowedEmailDomain(parsed.data.cursor))
  ) {
    return createJsonErrorResponse('Invalid identity search', 400, origin);
  }
  const result = await listIdentityAccounts(env, parsed.data);
  return createJsonResponse(result, 200, origin);
}

export async function getAdminIdentityHistory(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  if (!(await authorizedAdmin(req, env))) {
    return createJsonErrorResponse('Super admin access required', 403, origin);
  }
  const email = new URL(req.url).searchParams.get('email')?.toLowerCase();
  if (!email || !isAllowedEmailDomain(email)) {
    return createJsonErrorResponse(
      'Valid university email required',
      400,
      origin
    );
  }
  return createJsonResponse(
    { items: await getIdentityHistory(env, email) },
    200,
    origin
  );
}

export async function decideAdminIdentity(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const actorEmail = await authorizedAdmin(req, env);
  if (!actorEmail) {
    return createJsonErrorResponse('Super admin access required', 403, origin);
  }
  const parsed = IdentityDecisionRequestSchema.safeParse(
    await req.json().catch(() => null)
  );
  if (!parsed.success) {
    return createJsonErrorResponse('Invalid identity decision', 400, origin);
  }
  const decision = parsed.data;
  const email = decision.email.toLowerCase();
  if (!isAllowedEmailDomain(email)) {
    return createJsonErrorResponse('University email required', 400, origin);
  }
  try {
    validateRoleAssignment(email, decision.role);
  } catch {
    return createJsonErrorResponse('Student role is immutable', 409, origin);
  }
  if (
    (decision.status === 'APPROVED' && decision.role === 'OTHER') ||
    (decision.status === 'RETAINED_OTHER' && decision.role !== 'OTHER') ||
    (decision.status !== 'APPROVED' &&
      decision.status !== 'RETAINED_OTHER' &&
      decision.role !== decision.expectedRole)
  ) {
    return createJsonErrorResponse(
      'Role and review status conflict',
      400,
      origin
    );
  }
  const identity = await getAuthIdentityByEmail(email, env);
  const permission = await getUserPermission(email, env);
  if (!identity || !identity.emailVerified || !permission) {
    return createJsonErrorResponse(
      'Verified registered account required',
      404,
      origin
    );
  }
  if (permission.blacklisted) {
    return createJsonErrorResponse('Account is blacklisted', 409, origin);
  }
  if (permission.role !== decision.expectedRole) {
    return createJsonErrorResponse(
      'Account role changed; refresh',
      409,
      origin
    );
  }
  try {
    await saveIdentityDecision(env, {
      email,
      oldRole: decision.expectedRole,
      role: decision.role,
      status: decision.status,
      source: decision.source,
      note: decision.note,
      actorEmail,
    });
  } catch (error) {
    if (isIdentityMigrationMissing(error)) throw error;
    if (
      error instanceof Error &&
      (error.message === 'Account role changed; refresh before reviewing' ||
        error.message === 'Account permissions changed; refresh before editing')
    )
      return createJsonErrorResponse(error.message, 409, origin);
    console.error('Identity decision storage failed', error);
    return createJsonErrorResponse(
      'Identity decision unavailable',
      503,
      origin
    );
  }
  return createJsonResponse(
    { email, role: decision.role, status: decision.status },
    200,
    origin
  );
}

export async function suggestAdminIdentity(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  if (!(await authorizedAdmin(req, env))) {
    return createJsonErrorResponse('Super admin access required', 403, origin);
  }
  const parsed = z
    .object({
      evidence: z.string().trim().min(50).max(4000),
    })
    .strict()
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return createJsonErrorResponse(
      'Provide 50–4000 characters of explicit evidence',
      400,
      origin
    );
  }
  if (env.IDENTITY_JEV_ENABLED !== 'true' || !env.TYPESAFE_API_KEY) {
    return createJsonResponse({ kind: 'unavailable' }, 200, origin);
  }
  const request = {
    model: 'jev-latest',
    state: { evidence: parsed.data.evidence },
    questions: {
      academicCategory: {
        type: 'choice',
        instructions:
          'Classify only the explicitly supplied institutional evidence. Do not infer a role from a name, email, or title alone. If evidence is weak, conflicting, or outside these categories, say so.',
        criteria: {
          ACADEMIC:
            'Explicit appointment to academic teaching or research staff',
          NON_ACADEMIC:
            'Explicit appointment to non-academic administrative or technical staff',
          ACADEMIC_SUPPORT: 'Explicit appointment to academic support staff',
          insufficient: 'No reliable institutional appointment evidence',
          conflicting: 'Supplied evidence supports incompatible categories',
          unsupported: 'Evidence describes a category outside these roles',
        },
      },
    },
  };
  const form = new FormData();
  form.append(
    'request',
    new Blob([JSON.stringify(request)], { type: 'application/json' }),
    'request'
  );
  try {
    const response = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.TYPESAFE_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok)
      return createJsonResponse({ kind: 'unavailable' }, 200, origin);
    const result: unknown = await response.json();
    const answer = z
      .object({ answers: z.object({ academicCategory: z.unknown() }) })
      .safeParse(result);
    if (!answer.success)
      return createJsonResponse({ kind: 'unavailable' }, 200, origin);
    return createJsonResponse(
      {
        ...interpretJevSuggestion(answer.data.answers.academicCategory),
        evidenceSummary: parsed.data.evidence.slice(0, 300),
      },
      200,
      origin
    );
  } catch {
    return createJsonResponse({ kind: 'unavailable' }, 200, origin);
  }
}
