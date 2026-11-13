import { afterEach, expect, spyOn, test } from 'bun:test';
import {
  HonoursPreviewResponseSchema,
  operationIdForActorKey,
} from '@scs/schemas';

import apiWorker from '@/index';
import {
  claimHonoursIntent,
  renewHonoursIntentLease,
  updateHonoursIntent,
} from '@/repositories/honours-history.repo';
import {
  ACCESS_LEVEL,
  APP_ROLE,
  setUserPermission,
} from '@/repositories/permissions.repo';
import { reconcileDueHonoursIntents } from '@/services/honours.service';
import type { Env } from '@/types/env';
import { createTestEnv } from 'test/helpers/create-test-env';
import { createTestSessionCookie } from 'test/helpers/create-test-session';
import { invokeWorker } from 'test/helpers/invoke-worker';

afterEach(() => {
  (globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.();
});

async function fixture() {
  const admin = 'admin@sci.pdn.ac.lk';
  const student = 's21801@sci.pdn.ac.lk';
  let profile: Record<string, unknown> = {
    title: 'Mr',
    fullName: 'Student',
    email: student,
    registrationNo: 'S21801',
    studentType: 'UNDERGRADUATE',
    studentTrack: 'GENERAL',
    level: '3000',
    status: 'CURRENT',
  };
  let postCount = 0;
  let acceptedId = '';
  let failBeforeAccept = false;
  let loseAcceptedResponse = false;
  let githubStatus: 'queued' | 'running' | 'succeeded' | 'failed' = 'queued';
  let publication: 'pr_open' | 'published' = 'pr_open';
  const keys: string[] = [];
  const env = createTestEnv({
    GITHUB_APP: {
      fetch: async (request: Request) => {
        if (request.method === 'GET') {
          if (!acceptedId)
            return Response.json({ error: 'Not found' }, { status: 404 });
          const base = {
            version: 1,
            operationId: acceptedId,
            resource: { type: 'honours_batch', id: 's21' },
            actor: {
              type: 'user',
              subjectId: request.headers.get('X-Actor-Subject-Id'),
            },
            createdAt: '2026-11-13T00:00:00Z',
            updatedAt: '2026-11-13T00:00:00Z',
          };
          if (githubStatus === 'queued')
            return Response.json({ ...base, status: 'queued' });
          if (githubStatus === 'running')
            return Response.json({
              ...base,
              status: 'running',
              startedAt: base.updatedAt,
            });
          return Response.json({
            ...base,
            status: githubStatus,
            completedAt: base.updatedAt,
            ...(githubStatus === 'succeeded'
              ? {
                  outcome: {
                    status: 'succeeded',
                    pullRequest: {
                      number: 42,
                      url: 'https://github.com/example/repo/pull/42',
                    },
                  },
                  publication,
                }
              : {
                  outcome: {
                    status: 'failed',
                    error: {
                      code: 'operation_failed',
                      message: 'Failed',
                      correlationId: 'corr_1234567890123456',
                    },
                  },
                }),
          });
        }
        const body = (await request.json()) as {
          actorSubjectId: string;
          idempotencyKey: string;
        };
        keys.push(body.idempotencyKey);
        postCount += 1;
        if (failBeforeAccept)
          return Response.json({ error: 'Unavailable' }, { status: 503 });
        acceptedId = await operationIdForActorKey(
          { type: 'user', subjectId: body.actorSubjectId },
          body.idempotencyKey
        );
        if (loseAcceptedResponse)
          throw new Error('Connection lost after acceptance');
        return Response.json(
          {
            version: 1,
            operationId: acceptedId,
            status: 'queued',
            statusUrl: `/api/operations/${acceptedId}`,
            retryAfterMs: 500,
          },
          { status: 202 }
        );
      },
    } as unknown as NonNullable<Env['GITHUB_APP']>,
  });
  await setUserPermission(
    admin,
    {
      role: APP_ROLE.OTHER,
      accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
    },
    env
  );
  await setUserPermission(student, { role: APP_ROLE.STUDENT }, env);
  const now = Date.now();
  await env.AUTH_DB.prepare(
    `INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind('student1', 'Student', student, 1, now, now)
    .run();
  spyOn(globalThis, 'fetch').mockImplementation((async () =>
    Response.json([profile])) as unknown as typeof fetch);
  const headers = {
    Origin: 'https://portal.scs-pdn.space',
    'X-Client-Id': 'portal',
    Cookie: await createTestSessionCookie(env, admin),
    'Content-Type': 'application/json',
  };
  const selection = {
    batch: 's21',
    programme: 'STATISTICS_AND_OPERATIONS_RESEARCH',
    include: '801',
    exclude: '',
    additional: '',
    operation: 'assign',
  };
  const preview = await invokeWorker(
    '/api/admin/academic-rules/honours/preview',
    {
      method: 'POST',
      headers,
      body: JSON.stringify(selection),
    },
    env
  );
  const entries = HonoursPreviewResponseSchema.parse(
    await preview.json()
  ).entries;
  const body = JSON.stringify({
    ...selection,
    reason: 'Department board approved this assignment',
    idempotencyKey: 'honours-recovery-key-0001',
    expectedEntries: entries,
    overwriteConflicts: false,
    confirmation: true,
  });
  const apply = () =>
    invokeWorker(
      '/api/admin/academic-rules/honours/apply',
      {
        method: 'POST',
        headers,
        body,
      },
      env
    );
  const history = async () => {
    const response = await invokeWorker(
      '/api/admin/academic-rules/honours/history',
      {
        method: 'GET',
        headers,
      },
      env
    );
    return response.json() as Promise<{
      items: Array<{ operationId: string; status: string }>;
    }>;
  };
  const dueNow = async () => {
    await env.AUTH_DB.prepare(
      'UPDATE honours_operation_history SET next_attempt_at = 0, lease_until = 0'
    ).run();
  };
  return {
    env,
    admin,
    apply,
    history,
    dueNow,
    keys,
    headers,
    body,
    get postCount() {
      return postCount;
    },
    set failBeforeAccept(value: boolean) {
      failBeforeAccept = value;
    },
    set loseAcceptedResponse(value: boolean) {
      loseAcceptedResponse = value;
    },
    set githubStatus(value: typeof githubStatus) {
      githubStatus = value;
    },
    set publication(value: typeof publication) {
      publication = value;
    },
    set profile(value: Record<string, unknown>) {
      profile = value;
    },
  };
}

test('intent insertion failure prevents any GitHub acceptance', async () => {
  const state = await fixture();
  const originalDb = state.env.AUTH_DB;
  state.env.AUTH_DB = {
    ...originalDb,
    prepare(sql: string) {
      if (sql.includes('INSERT OR IGNORE INTO honours_operation_history'))
        throw new Error('Intent insert failed');
      return originalDb.prepare(sql);
    },
  } as D1Database;
  expect((await state.apply()).status).toBe(502);
  expect(state.postCount).toBe(0);
  state.env.AUTH_DB = originalDb;
  expect((await state.history()).items).toEqual([]);
});

test('a persisted intent retries after disconnect and process restart with one operation ID', async () => {
  const state = await fixture();
  state.failBeforeAccept = true;
  const response = await state.apply();
  expect(response.status).toBe(202);
  const id = ((await response.json()) as { operationId: string }).operationId;
  expect((await state.history()).items).toMatchObject([
    { operationId: id, status: 'pending_acceptance' },
  ]);
  state.failBeforeAccept = false;
  await state.dueNow();
  await reconcileDueHonoursIntents(state.env);
  expect((await state.history()).items).toMatchObject([
    { operationId: id, status: 'accepted' },
  ]);
  expect(state.keys).toEqual([
    'honours-recovery-key-0001',
    'honours-recovery-key-0001',
  ]);
  await state.dueNow();
  await reconcileDueHonoursIntents(state.env);
  expect(state.postCount).toBe(2);
  expect((await state.apply()).status).toBe(202);
  expect(state.postCount).toBe(2);
});

test('scheduled Worker recovery dispatches a persisted intent without a browser', async () => {
  const state = await fixture();
  state.failBeforeAccept = true;
  await state.apply();
  state.failBeforeAccept = false;
  await state.dueNow();
  let background: Promise<unknown> | null = null;
  apiWorker.scheduled({} as ScheduledEvent, state.env, {
    waitUntil(task: Promise<unknown>) {
      background = task;
    },
  } as ExecutionContext);
  await background;
  expect((await state.history()).items[0]?.status).toBe('accepted');
  expect(state.postCount).toBe(2);
});

test('lost acceptance response is recovered from the GitHub App store without a client key', async () => {
  const state = await fixture();
  state.loseAcceptedResponse = true;
  expect((await state.apply()).status).toBe(202);
  expect((await state.history()).items[0]?.status).toBe('pending_acceptance');
  await state.dueNow();
  await reconcileDueHonoursIntents(state.env);
  expect((await state.history()).items[0]?.status).toBe('accepted');
  expect(state.postCount).toBe(1);
});

test('concurrent retries share one intent and one GitHub acceptance', async () => {
  const state = await fixture();
  const [first, second] = await Promise.all([state.apply(), state.apply()]);
  expect(first.status).toBe(202);
  expect(second.status).toBe(202);
  expect((await state.history()).items).toHaveLength(1);
  expect(state.postCount).toBe(1);
});

test('reusing a key for different Honours changes is rejected before GitHub submission', async () => {
  const state = await fixture();
  await state.apply();
  const changed = {
    ...JSON.parse(state.body),
    reason: 'A different board decision',
  };
  const response = await invokeWorker(
    '/api/admin/academic-rules/honours/apply',
    {
      method: 'POST',
      headers: state.headers,
      body: JSON.stringify(changed),
    },
    state.env
  );
  expect(response.status).toBe(409);
  expect(state.postCount).toBe(1);
});

test('a new key for an active identical request finds the existing operation', async () => {
  const state = await fixture();
  const first = await state.apply();
  const original = (await first.json()) as { operationId: string };
  const changed = {
    ...JSON.parse(state.body),
    idempotencyKey: 'honours-recovery-new-key-0002',
  };
  const second = await invokeWorker(
    '/api/admin/academic-rules/honours/apply',
    {
      method: 'POST',
      headers: state.headers,
      body: JSON.stringify(changed),
    },
    state.env
  );
  expect(second.status).toBe(202);
  expect(await second.json()).toMatchObject({
    operationId: original.operationId,
  });
  expect((await state.history()).items).toHaveLength(1);
  expect(state.postCount).toBe(1);
});

test('concurrent different keys for identical requests converge on one intent', async () => {
  const state = await fixture();
  const secondBody = JSON.stringify({
    ...JSON.parse(state.body),
    idempotencyKey: 'honours-recovery-new-key-0003',
  });
  const [first, second] = await Promise.all([
    state.apply(),
    invokeWorker(
      '/api/admin/academic-rules/honours/apply',
      {
        method: 'POST',
        headers: state.headers,
        body: secondBody,
      },
      state.env
    ),
  ]);
  expect(first.status).toBe(202);
  expect(second.status).toBe(202);
  expect(((await first.json()) as { operationId: string }).operationId).toBe(
    ((await second.json()) as { operationId: string }).operationId
  );
  expect((await state.history()).items).toHaveLength(1);
  expect(state.postCount).toBe(1);
});

test('pending intent is rejected if authority or published classification changed', async () => {
  const revoked = await fixture();
  revoked.failBeforeAccept = true;
  await revoked.apply();
  await setUserPermission(
    revoked.admin,
    {
      role: APP_ROLE.OTHER,
      accessLevel: ACCESS_LEVEL.NONE,
    },
    revoked.env
  );
  revoked.failBeforeAccept = false;
  await revoked.dueNow();
  await reconcileDueHonoursIntents(revoked.env);
  expect(
    await revoked.env.AUTH_DB.prepare(
      'SELECT status FROM honours_operation_history'
    ).first()
  ).toMatchObject({ status: 'failed' });
  expect(revoked.postCount).toBe(1);
});

test('pending intent does not apply a stale Honours classification', async () => {
  const state = await fixture();
  state.failBeforeAccept = true;
  await state.apply();
  state.profile = {
    title: 'Mr',
    fullName: 'Student',
    email: 's21801@sci.pdn.ac.lk',
    registrationNo: 'S21801',
    studentType: 'UNDERGRADUATE',
    studentTrack: 'HONOURS',
    honoursProgramme: 'COMPUTER_SCIENCE',
    level: '3000',
    status: 'CURRENT',
  };
  state.failBeforeAccept = false;
  await state.dueNow();
  await reconcileDueHonoursIntents(state.env);
  expect((await state.history()).items[0]?.status).toBe('failed');
  expect(state.postCount).toBe(1);
});

test('reconciliation records processing, publication, and failure states', async () => {
  const state = await fixture();
  await state.apply();
  for (const [githubStatus, publication, expected] of [
    ['running', 'pr_open', 'processing'],
    ['succeeded', 'pr_open', 'awaiting_publication'],
    ['succeeded', 'published', 'published'],
  ] as const) {
    state.githubStatus = githubStatus;
    state.publication = publication;
    await state.dueNow();
    await reconcileDueHonoursIntents(state.env);
    expect((await state.history()).items[0]?.status).toBe(expected);
  }
});

test('durable GitHub operation failure appears in administrative history', async () => {
  const state = await fixture();
  await state.apply();
  state.githubStatus = 'failed';
  await state.dueNow();
  await reconcileDueHonoursIntents(state.env);
  expect((await state.history()).items[0]?.status).toBe('failed');
});

test('expired recovery worker cannot overwrite a newer intent state', async () => {
  const state = await fixture();
  state.failBeforeAccept = true;
  const response = await state.apply();
  const { operationId } = (await response.json()) as { operationId: string };
  await state.dueNow();
  const first = await claimHonoursIntent(state.env, operationId, Date.now());
  expect(first).toBeString();
  await state.dueNow();
  const second = await claimHonoursIntent(state.env, operationId, Date.now());
  expect(second).toBeString();
  expect(
    await renewHonoursIntentLease(state.env, operationId, first!, Date.now())
  ).toBe(false);
  await updateHonoursIntent(
    state.env,
    operationId,
    'failed',
    0,
    'stale worker',
    first!
  );
  expect((await state.history()).items[0]?.status).toBe('pending_acceptance');
  await updateHonoursIntent(
    state.env,
    operationId,
    'accepted',
    0,
    null,
    second!
  );
  expect((await state.history()).items[0]?.status).toBe('accepted');
});
