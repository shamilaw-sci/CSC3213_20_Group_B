import { canManageStudentHonours, parseHonoursSelection } from '@scs/identity';
import {
  HonoursBulkAcceptedSchema,
  HonoursApplyResponseSchema,
  HonoursBulkApplyRequestSchema,
  type HonoursBulkChange,
  HonoursPreviewRequestSchema,
  type HonoursPreviewResponse,
  HonoursPreviewResponseSchema,
  HonoursProgrammeDepartmentMap,
  OperationStatusResponseSchema,
  operationIdForActorKey,
  type AcademicDepartmentCode,
  StudentSchema,
} from '@scs/schemas';
import type { z } from 'zod';

import { callGithubApp } from '@/clients/github-app.client';
import {
  createJsonErrorResponse,
  createJsonResponse,
  getRequestOrigin,
} from '@/http/responses';
import { verifySessionRequest } from '@/middleware/session';
import {
  claimHonoursIntent,
  getActiveHonoursIntentByHash,
  getHonoursIntent,
  listHonoursOperations,
  listDueHonoursIntentIds,
  renewHonoursIntentLease,
  saveHonoursIntent,
  updateHonoursIntent,
  type HonoursIntent,
} from '@/repositories/honours-history.repo';
import { actorSubjectId } from '@/services/mutation-operation.service';
import { getVerifiedStudentEmails } from '@/repositories/identity.repo';
import {
  getUserPermission,
  isSuperAdmin,
} from '@/repositories/permissions.repo';
import type { Env } from '@/types/env';

type PreviewInput = z.infer<typeof HonoursPreviewRequestSchema>;
type Outcome = HonoursPreviewResponse['entries'][number]['outcome'];

type HonoursActor = {
  email: string;
  scoped: boolean;
  departments: readonly AcademicDepartmentCode[];
};

type Permission = NonNullable<Awaited<ReturnType<typeof getUserPermission>>>;

function permittedActor(
  email: string,
  permission: Permission | null,
  programme: PreviewInput['programme']
): HonoursActor | null {
  if (!permission || permission.blacklisted) return null;
  if (isSuperAdmin(permission) || permission.accessLevel === 'ADMIN')
    return { email: email.toLowerCase(), scoped: false, departments: [] };
  const departments = permission.honoursDepartments ?? [];
  return permission.role === 'ACADEMIC' &&
    departments.includes(HonoursProgrammeDepartmentMap[programme])
    ? { email: email.toLowerCase(), scoped: true, departments }
    : null;
}

async function authorisedActor(
  req: Request,
  env: Env,
  programme: PreviewInput['programme']
): Promise<HonoursActor | null> {
  const session = await verifySessionRequest(req, env);
  if (!session.ok) return null;
  const actor: { email?: string } = await session.json();
  const permission = actor.email
    ? await getUserPermission(actor.email, env)
    : null;
  return actor.email
    ? permittedActor(actor.email, permission, programme)
    : null;
}

async function requestHash(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(value))
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

function nextRetry(attempt: number): number {
  return Date.now() + Math.min(900_000, 30_000 * 2 ** Math.min(attempt, 5));
}

async function githubOperationStatus(env: Env, intent: HonoursIntent) {
  return callGithubApp(
    env,
    '',
    `/operations/${intent.operationId}`,
    {
      method: 'GET',
      headers: {
        'X-Actor-Subject-Id': intent.actorSubjectId,
        'X-Correlation-Id': intent.correlationId,
      },
    },
    { schema: OperationStatusResponseSchema }
  );
}

/** The database lease bounds concurrent API and scheduled recovery attempts. */
async function reconcileHonoursIntent(
  env: Env,
  operationId: string
): Promise<void> {
  const now = Date.now();
  const claimed = await claimHonoursIntent(env, operationId, now);
  if (claimed === null) return;
  const leaseToken = claimed;
  const intent = await getHonoursIntent(env, operationId);
  if (!intent) return;
  const finish = (
    status: HonoursIntent['status'],
    nextAttemptAt: number,
    error: string | null = null
  ) =>
    updateHonoursIntent(
      env,
      operationId,
      status,
      nextAttemptAt,
      error,
      leaseToken
    );
  try {
    const existing = await githubOperationStatus(env, intent);
    if (existing.ok) {
      const status = existing.value;
      const historyStatus =
        status.status === 'running'
          ? 'processing'
          : status.status === 'succeeded'
            ? status.publication === 'published'
              ? 'published'
              : status.publication === 'closed' ||
                  status.publication === 'superseded'
                ? 'failed'
                : 'awaiting_publication'
            : status.status === 'queued'
              ? 'accepted'
              : 'failed';
      await finish(
        historyStatus,
        historyStatus === 'published' || historyStatus === 'failed'
          ? 0
          : Date.now() + 60_000
      );
      return;
    }
    if (existing.response.status !== 404) {
      await finish(
        intent.status,
        nextRetry(intent.attemptCount),
        'Operation status unavailable'
      );
      return;
    }
    if (intent.status !== 'pending_acceptance') {
      await finish(
        'failed',
        0,
        'Accepted operation is missing from the durable store'
      );
      return;
    }
    const permission = await getUserPermission(intent.actorEmail, env);
    const actor = permittedActor(
      intent.actorEmail,
      permission,
      intent.apply.programme
    );
    if (!actor) {
      await finish('failed', 0, 'Actor no longer has Honours authority');
      return;
    }
    const current = await calculatePreview(env, intent.apply, actor);
    if (
      JSON.stringify(current.entries) !==
      JSON.stringify(intent.apply.expectedEntries)
    ) {
      await finish('failed', 0, 'Honours preview changed before acceptance');
      return;
    }
    const renewed = await renewHonoursIntentLease(
      env,
      operationId,
      leaseToken,
      Date.now()
    );
    if (!renewed) return;
    const response = await callGithubApp(
      env,
      '',
      '/people/honours/operations',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-Id': intent.correlationId,
        },
        body: JSON.stringify({
          request: {
            batch: intent.batch,
            programme: intent.programme,
            operation: intent.operation,
            reason: intent.reason,
            updatedBy: intent.actorEmail,
            changes: intent.changes,
          },
          actorSubjectId: intent.actorSubjectId,
          idempotencyKey: intent.idempotencyKey,
          correlationId: intent.correlationId,
        }),
      },
      { schema: HonoursBulkAcceptedSchema }
    );
    if (!response.ok) {
      const status = response.response.status;
      await finish(
        status >= 400 && status < 500 && status !== 429
          ? 'failed'
          : 'pending_acceptance',
        nextRetry(intent.attemptCount),
        `GitHub App acceptance returned ${status}`
      );
      return;
    }
    if (response.value.operationId !== operationId) {
      throw new Error('GitHub App operation identity did not match intent');
    }
    await finish('accepted', Date.now() + 60_000);
  } catch (error) {
    console.error('Honours intent reconciliation failed', {
      operationId,
      error,
    });
    await finish(
      intent.status,
      nextRetry(intent.attemptCount),
      'Reconciliation temporarily unavailable'
    );
  }
}

export async function reconcileDueHonoursIntents(env: Env): Promise<void> {
  const ids = await listDueHonoursIntentIds(env, Date.now());
  for (const id of ids) {
    try {
      await reconcileHonoursIntent(env, id);
    } catch (error) {
      console.error('Honours intent recovery failed', { id, error });
    }
  }
}

async function calculatePreview(
  env: Env,
  input: PreviewInput,
  actor: HonoursActor
): Promise<HonoursPreviewResponse> {
  const selection = parseHonoursSelection(input);
  const batch = input.batch.toLowerCase();
  const url = new URL(
    `/people/v2/students/${batch}.json`,
    env.DATA_PUBLIC_BASE_URL
  );
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('Published batch unavailable');
  const published: unknown = await response.json();
  if (!Array.isArray(published)) {
    throw new Error('Published batch is invalid');
  }
  const profiles = new Map<string, z.infer<typeof StudentSchema>>();
  for (const value of published) {
    const student = StudentSchema.safeParse(value);
    if (student.success) {
      profiles.set(student.data.registrationNo.toLowerCase(), student.data);
    }
  }
  const emails = selection.identifiers.map((id) => `${id}@sci.pdn.ac.lk`);
  const registered = await getVerifiedStudentEmails(env, emails);
  const entries = selection.identifiers.map((id) => {
    const profile = profiles.get(id);
    const email = `${id}@sci.pdn.ac.lk`;
    let outcome: Outcome;
    if (!registered.has(email)) outcome = 'missing_account';
    else if (!profile) outcome = 'no_public_profile';
    else if (
      profile.studentType !== 'UNDERGRADUATE' ||
      (input.operation === 'revoke' && profile.level === '4000')
    )
      outcome = 'ineligible';
    else if (
      actor.scoped &&
      !canManageStudentHonours({
        departments: actor.departments,
        programme: input.programme,
        student: profile,
      })
    )
      outcome = 'ineligible';
    else if (input.operation === 'revoke') {
      outcome =
        profile.studentTrack === 'HONOURS' ? 'planned_revoke' : 'unchanged';
    } else if (profile.studentTrack !== 'HONOURS') outcome = 'planned_assign';
    else if (profile.honoursProgramme === input.programme) outcome = 'matching';
    else outcome = 'conflict';
    if (
      profile &&
      (outcome === 'planned_assign' ||
        outcome === 'planned_revoke' ||
        outcome === 'conflict')
    ) {
      const proposed = {
        ...profile,
        studentTrack: input.operation === 'revoke' ? 'GENERAL' : 'HONOURS',
        honoursProgramme:
          input.operation === 'revoke' ? undefined : input.programme,
      };
      if (!StudentSchema.safeParse(proposed).success) outcome = 'ineligible';
    }
    return {
      identifier: id.toUpperCase(),
      outcome,
      oldTrack: profile?.studentTrack ?? null,
      oldProgramme: profile?.honoursProgramme ?? null,
      newTrack: outcome.startsWith('planned_')
        ? input.operation === 'revoke'
          ? 'GENERAL'
          : 'HONOURS'
        : null,
      newProgramme:
        outcome.startsWith('planned_') && input.operation !== 'revoke'
          ? input.programme
          : null,
    };
  });
  const counts = Object.fromEntries(
    [...new Set(entries.map((entry) => entry.outcome))].map((outcome) => [
      outcome,
      entries.filter((entry) => entry.outcome === outcome).length,
    ])
  );
  return HonoursPreviewResponseSchema.parse({
    batch,
    programme: input.programme,
    operation: input.operation,
    total: selection.identifiers.length,
    excluded: selection.excluded.map((id) => id.toUpperCase()),
    counts,
    entries,
  });
}

export async function previewHonours(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const parsed = HonoursPreviewRequestSchema.safeParse(
    await req.json().catch(() => null)
  );
  if (!parsed.success)
    return createJsonErrorResponse(
      'Invalid Honours preview request',
      400,
      origin
    );
  const actor = await authorisedActor(req, env, parsed.data.programme);
  if (!actor)
    return createJsonErrorResponse(
      'Honours programme access required',
      403,
      origin
    );
  try {
    return createJsonResponse(
      await calculatePreview(env, parsed.data, actor),
      200,
      origin
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Preview unavailable';
    return createJsonErrorResponse(
      message,
      message.startsWith('Published') ? 502 : 400,
      origin
    );
  }
}

export async function applyHonours(req: Request, env: Env): Promise<Response> {
  const origin = getRequestOrigin(req);
  const parsed = HonoursBulkApplyRequestSchema.safeParse(
    await req.json().catch(() => null)
  );
  if (!parsed.success)
    return createJsonErrorResponse(
      'Invalid Honours apply request',
      400,
      origin
    );
  const input = parsed.data;
  const actor = await authorisedActor(req, env, input.programme);
  if (!actor)
    return createJsonErrorResponse(
      'Honours programme access required',
      403,
      origin
    );
  const subjectId = await actorSubjectId(actor.email);
  const operationId = await operationIdForActorKey(
    { type: 'user', subjectId },
    input.idempotencyKey
  );
  const hash = await requestHash({ ...input, idempotencyKey: undefined });
  try {
    const sameKey = await getHonoursIntent(env, operationId);
    if (
      sameKey &&
      (sameKey.actorEmail !== actor.email || sameKey.requestHash !== hash)
    )
      return createJsonErrorResponse(
        'Idempotency key already used for another Honours request',
        409,
        origin
      );
    const existing =
      sameKey ?? (await getActiveHonoursIntentByHash(env, subjectId, hash));
    if (existing) {
      await reconcileHonoursIntent(env, existing.operationId);
      const current = await getHonoursIntent(env, existing.operationId);
      return createJsonResponse(
        HonoursApplyResponseSchema.parse({
          version: 1,
          operationId: existing.operationId,
          status: current?.status ?? existing.status,
          statusUrl: `/api/operations/${existing.operationId}`,
          plannedChanges: existing.changes.length,
        }),
        202,
        origin
      );
    }
  } catch {
    return createJsonErrorResponse(
      'Honours intent store unavailable',
      502,
      origin
    );
  }
  let current: HonoursPreviewResponse;
  try {
    current = await calculatePreview(env, input, actor);
  } catch {
    return createJsonErrorResponse(
      'Unable to revalidate Honours selection',
      502,
      origin
    );
  }
  if (
    JSON.stringify(current.entries) !== JSON.stringify(input.expectedEntries)
  ) {
    return createJsonErrorResponse(
      'Honours preview changed; preview again',
      409,
      origin
    );
  }
  const changes: HonoursBulkChange[] = current.entries.flatMap((entry) => {
    const planned =
      entry.outcome === 'planned_assign' || entry.outcome === 'planned_revoke';
    const conflict = entry.outcome === 'conflict' && input.overwriteConflicts;
    if (!planned && !conflict) return [];
    return [
      {
        identifier: entry.identifier,
        oldTrack: entry.oldTrack,
        oldProgramme: entry.oldProgramme,
        newTrack: input.operation === 'revoke' ? 'GENERAL' : 'HONOURS',
        newProgramme: input.operation === 'revoke' ? null : input.programme,
      },
    ];
  });
  if (changes.length === 0 || changes.length > 250) {
    return createJsonErrorResponse(
      'Expected 1–250 eligible changes',
      400,
      origin
    );
  }
  let intent: HonoursIntent;
  try {
    intent = await saveHonoursIntent(env, {
      operationId,
      actorEmail: actor.email,
      actorSubjectId: subjectId,
      idempotencyKey: input.idempotencyKey,
      correlationId: crypto.randomUUID(),
      apply: input,
      requestHash: hash,
      batch: current.batch,
      programme: input.programme,
      operation: input.operation,
      reason: input.reason,
      changes,
      status: 'pending_acceptance',
      attemptCount: 0,
      createdAt: Date.now(),
    });
  } catch {
    return createJsonErrorResponse(
      'Unable to persist Honours intent',
      502,
      origin
    );
  }
  if (intent.requestHash !== hash || intent.actorEmail !== actor.email)
    return createJsonErrorResponse(
      'Idempotency key already used for another Honours request',
      409,
      origin
    );
  await reconcileHonoursIntent(env, intent.operationId).catch(
    (error: unknown) =>
      console.error('Honours immediate reconciliation failed', {
        operationId: intent.operationId,
        error,
      })
  );
  const latest = await getHonoursIntent(env, intent.operationId).catch(
    () => null
  );
  return createJsonResponse(
    HonoursApplyResponseSchema.parse({
      version: 1,
      operationId: intent.operationId,
      status: latest?.status ?? 'pending_acceptance',
      statusUrl: `/api/operations/${intent.operationId}`,
      plannedChanges: intent.changes.length,
    }),
    202,
    origin
  );
}

export async function getHonoursHistory(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const session = await verifySessionRequest(req, env);
  if (!session.ok) return session;
  const identity: { email?: string } = await session.json();
  const permission = identity.email
    ? await getUserPermission(identity.email, env)
    : null;
  if (!identity.email || !permission || permission.blacklisted) {
    return createJsonErrorResponse('Honours access required', 403, origin);
  }
  const fullAccess = isSuperAdmin(permission);
  if (
    !fullAccess &&
    permission.accessLevel !== 'ADMIN' &&
    (permission.role !== 'ACADEMIC' || !permission.honoursDepartments?.length)
  ) {
    return createJsonErrorResponse('Honours access required', 403, origin);
  }
  const cursor = new URL(req.url).searchParams.get('cursor') ?? undefined;
  if (cursor && !/^\d{1,16}:[A-Za-z0-9_-]{16,128}$/.test(cursor)) {
    return createJsonErrorResponse(
      'Invalid Honours history cursor',
      400,
      origin
    );
  }
  try {
    return createJsonResponse(
      await listHonoursOperations(env, {
        ...(fullAccess ? {} : { actorEmail: identity.email }),
        ...(cursor ? { cursor } : {}),
      }),
      200,
      origin
    );
  } catch {
    return createJsonErrorResponse(
      'Unable to list Honours history',
      502,
      origin
    );
  }
}
