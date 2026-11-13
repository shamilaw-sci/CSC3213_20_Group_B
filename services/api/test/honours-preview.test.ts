import { afterEach, expect, spyOn, test } from 'bun:test';

import {
  HonoursPreviewResponseSchema,
  operationIdForActorKey,
} from '@scs/schemas';

import { recordHonoursOperation } from '@/repositories/honours-history.repo';
import { reconcileDueHonoursIntents } from '@/services/honours.service';
import {
  ACCESS_LEVEL,
  APP_ROLE,
  setUserPermission,
} from '@/repositories/permissions.repo';
import type { Env } from '@/types/env';
import { createTestEnv } from 'test/helpers/create-test-env';
import { createTestSessionCookie } from 'test/helpers/create-test-session';
import { invokeWorker } from 'test/helpers/invoke-worker';

afterEach(() => {
  (globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.();
});

test('Honours preview reads a batch once and does not publish changes', async () => {
  const upstreamBodies: unknown[] = [];
  let acceptedId = '';
  const env = createTestEnv({
    GITHUB_APP: {
      fetch: async (request: Request) => {
        if (request.method === 'GET') {
          if (!acceptedId)
            return Response.json({ error: 'Not found' }, { status: 404 });
          return Response.json({
            version: 1,
            operationId: acceptedId,
            resource: { type: 'honours_batch', id: 's21' },
            actor: {
              type: 'user',
              subjectId: request.headers.get('X-Actor-Subject-Id'),
            },
            status: 'queued',
            createdAt: '2026-11-13T00:00:00Z',
            updatedAt: '2026-11-13T00:00:00Z',
          });
        }
        const body = (await request.json()) as {
          actorSubjectId: string;
          idempotencyKey: string;
        };
        upstreamBodies.push(body);
        acceptedId = await operationIdForActorKey(
          { type: 'user', subjectId: body.actorSubjectId },
          body.idempotencyKey
        );
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
  const admin = 'admin@sci.pdn.ac.lk';
  const student = 's21801@sci.pdn.ac.lk';
  const now = Date.now();
  await setUserPermission(
    admin,
    { role: APP_ROLE.OTHER, accessLevel: ACCESS_LEVEL.SUPER_ADMIN },
    env
  );
  await setUserPermission(student, { role: APP_ROLE.STUDENT }, env);
  await env.AUTH_DB.prepare(
    `INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind('student1', 'Student', student, 1, now, now)
    .run();
  const fetchMock = spyOn(globalThis, 'fetch').mockImplementation((async () =>
    Response.json([
      {
        title: 'Mr',
        fullName: 'Student',
        email: student,
        registrationNo: 'S21801',
        studentType: 'UNDERGRADUATE',
        studentTrack: 'GENERAL',
        level: '3000',
        status: 'CURRENT',
      },
    ])) as unknown as typeof fetch);
  const headers = {
    Origin: 'https://portal.scs-pdn.space',
    'X-Client-Id': 'portal',
    Cookie: await createTestSessionCookie(env, admin),
    'Content-Type': 'application/json',
  };
  const selection = {
    batch: 's21',
    programme: 'STATISTICS_AND_OPERATIONS_RESEARCH',
    include: '801, 802',
    exclude: '',
    additional: '',
    operation: 'assign',
  };
  const response = await invokeWorker(
    '/api/admin/academic-rules/honours/preview',
    {
      method: 'POST',
      headers,
      body: JSON.stringify(selection),
    },
    env
  );
  expect(response.status).toBe(200);
  const result = HonoursPreviewResponseSchema.parse(await response.json());
  expect(result).toMatchObject({
    total: 2,
    counts: { planned_assign: 1, missing_account: 1 },
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(upstreamBodies).toHaveLength(0);
  const applyBody = JSON.stringify({
    ...selection,
    reason: 'Department board approved this assignment',
    idempotencyKey: 'honours-batch-2026-0001',
    expectedEntries: result.entries,
    overwriteConflicts: false,
    confirmation: true,
  });
  const apply = await invokeWorker(
    '/api/admin/academic-rules/honours/apply',
    {
      method: 'POST',
      headers,
      body: applyBody,
    },
    env
  );
  expect(apply.status).toBe(202);
  expect(upstreamBodies).toHaveLength(1);
  expect(upstreamBodies[0]).toMatchObject({
    request: {
      batch: 's21',
      changes: [
        { identifier: 'S21801', oldTrack: 'GENERAL', newTrack: 'HONOURS' },
      ],
    },
  });
  const history = await invokeWorker(
    '/api/admin/academic-rules/honours/history',
    {
      method: 'GET',
      headers,
    },
    env
  );
  expect(history.status).toBe(200);
  expect(await history.json()).toMatchObject({
    items: [
      {
        operationId: acceptedId,
        actorEmail: admin,
        batch: 's21',
        changes: [
          { identifier: 'S21801', oldTrack: 'GENERAL', newTrack: 'HONOURS' },
        ],
      },
    ],
  });
  const retry = await invokeWorker(
    '/api/admin/academic-rules/honours/apply',
    { method: 'POST', headers, body: applyBody },
    env
  );
  expect(retry.status).toBe(202);
  const afterRetry = await invokeWorker(
    '/api/admin/academic-rules/honours/history',
    { method: 'GET', headers },
    env
  );
  expect(
    ((await afterRetry.json()) as { items: unknown[] }).items
  ).toHaveLength(1);
});

test('accepted operation ID survives an API history write failure', async () => {
  let operationId = '';
  let accepted = false;
  const env = createTestEnv({
    GITHUB_APP: {
      fetch: async (request: Request) => {
        if (request.method === 'GET') {
          if (!accepted)
            return Response.json({ error: 'Not found' }, { status: 404 });
          return Response.json({
            version: 1,
            operationId,
            resource: { type: 'honours_batch', id: 's21' },
            actor: {
              type: 'user',
              subjectId: request.headers.get('X-Actor-Subject-Id'),
            },
            status: 'queued',
            createdAt: '2026-11-13T00:00:00Z',
            updatedAt: '2026-11-13T00:00:00Z',
          });
        }
        const body = (await request.json()) as {
          actorSubjectId: string;
          idempotencyKey: string;
        };
        operationId = await operationIdForActorKey(
          { type: 'user', subjectId: body.actorSubjectId },
          body.idempotencyKey
        );
        accepted = true;
        return Response.json(
          {
            version: 1,
            operationId,
            status: 'queued',
            statusUrl: `/api/operations/${operationId}`,
            retryAfterMs: 500,
          },
          { status: 202 }
        );
      },
    } as unknown as NonNullable<Env['GITHUB_APP']>,
  });
  const admin = 'admin@sci.pdn.ac.lk';
  const student = 's21801@sci.pdn.ac.lk';
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
  const originalDb = env.AUTH_DB;
  const headers = {
    Origin: 'https://portal.scs-pdn.space',
    'X-Client-Id': 'portal',
    Cookie: await createTestSessionCookie(env, admin),
    'Content-Type': 'application/json',
  };
  spyOn(globalThis, 'fetch').mockImplementation((async () =>
    Response.json([
      {
        title: 'Mr',
        fullName: 'Student',
        email: student,
        registrationNo: 'S21801',
        studentType: 'UNDERGRADUATE',
        studentTrack: 'GENERAL',
        level: '3000',
        status: 'CURRENT',
      },
    ])) as unknown as typeof fetch);
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
  env.AUTH_DB = {
    ...originalDb,
    prepare(sql: string) {
      if (sql.includes('UPDATE honours_operation_history SET status'))
        throw new Error('Simulated history outage');
      return originalDb.prepare(sql);
    },
  } as D1Database;
  const errorLog = spyOn(console, 'error').mockImplementation(() => {});
  try {
    const apply = await invokeWorker(
      '/api/admin/academic-rules/honours/apply',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...selection,
          reason: 'Department board approved this assignment',
          idempotencyKey: 'honours-history-outage-0001',
          expectedEntries: entries,
          overwriteConflicts: false,
          confirmation: true,
        }),
      },
      env
    );
    expect(accepted).toBe(true);
    expect(apply.status).toBe(202);
    expect(await apply.json()).toMatchObject({
      operationId,
      status: 'pending_acceptance',
    });
    env.AUTH_DB = originalDb;
    const history = await invokeWorker(
      '/api/admin/academic-rules/honours/history',
      {
        method: 'GET',
        headers,
      },
      env
    );
    expect(await history.json()).toMatchObject({
      items: [{ operationId, status: 'pending_acceptance' }],
    });
    await env.AUTH_DB.prepare(
      'UPDATE honours_operation_history SET lease_until = 0 WHERE operation_id = ?'
    )
      .bind(operationId)
      .run();
    await reconcileDueHonoursIntents(env);
    const recovered = await invokeWorker(
      '/api/admin/academic-rules/honours/history',
      { method: 'GET', headers },
      env
    );
    expect(await recovered.json()).toMatchObject({
      items: [{ operationId, status: 'accepted' }],
    });
    const status = await invokeWorker(
      `/api/operations/${operationId}`,
      { method: 'GET', headers },
      env
    );
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({
      operationId,
      status: 'queued',
    });
  } finally {
    errorLog.mockRestore();
  }
});

test('academic Honours authority is limited to explicit departments', async () => {
  const env = createTestEnv();
  const hod = 'hod@sci.pdn.ac.lk';
  await setUserPermission(
    hod,
    {
      role: APP_ROLE.ACADEMIC,
      honoursDepartments: ['STATISTICS_AND_COMPUTER_SCIENCE'],
    },
    env
  );
  const headers = {
    Origin: 'https://portal.scs-pdn.space',
    'X-Client-Id': 'portal',
    Cookie: await createTestSessionCookie(env, hod),
    'Content-Type': 'application/json',
  };
  const selection = {
    batch: 's21',
    programme: 'CHEMISTRY',
    include: '801',
    exclude: '',
    additional: '',
    operation: 'assign',
  };
  const denied = await invokeWorker(
    '/api/admin/academic-rules/honours/preview',
    {
      method: 'POST',
      headers,
      body: JSON.stringify(selection),
    },
    env
  );
  expect(denied.status).toBe(403);
  const deniedApply = await invokeWorker(
    '/api/admin/academic-rules/honours/apply',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...selection,
        reason: 'Approved by department board',
        idempotencyKey: 'honours-scope-check-0001',
        expectedEntries: [
          {
            identifier: 'S21801',
            outcome: 'planned_assign',
            oldTrack: 'GENERAL',
            oldProgramme: null,
            newTrack: 'HONOURS',
            newProgramme: 'CHEMISTRY',
          },
        ],
        overwriteConflicts: false,
        confirmation: true,
      }),
    },
    env
  );
  expect(deniedApply.status).toBe(403);
  await recordHonoursOperation(env, {
    operationId: 'op_12345678901234567891',
    actorEmail: 'other@sci.pdn.ac.lk',
    batch: 's21',
    programme: 'STATISTICS',
    operation: 'assign',
    reason: 'Approved by another department board',
    changes: [],
    createdAt: Date.now(),
  });
  const history = await invokeWorker(
    '/api/admin/academic-rules/honours/history',
    {
      method: 'GET',
      headers,
    },
    env
  );
  expect(history.status).toBe(200);
  expect(((await history.json()) as { items: unknown[] }).items).toHaveLength(
    0
  );
  const now = Date.now();
  for (const [number, registrationNo] of [
    ['801', 'S21801'],
    ['802', 'S21802'],
  ]) {
    const email = `${registrationNo.toLowerCase()}@sci.pdn.ac.lk`;
    await setUserPermission(email, { role: APP_ROLE.STUDENT }, env);
    await env.AUTH_DB.prepare(
      `INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(`student${number}`, 'Student', email, 1, now, now)
      .run();
  }
  const upstream = spyOn(globalThis, 'fetch').mockImplementation((async () =>
    Response.json(
      ['S21801', 'S21802'].map((registrationNo, index) => ({
        title: 'Mr',
        fullName: 'Student',
        email: `${registrationNo.toLowerCase()}@sci.pdn.ac.lk`,
        registrationNo,
        studentType: 'UNDERGRADUATE',
        studentTrack: 'GENERAL',
        level: '3000',
        status: 'CURRENT',
        ...(index === 0
          ? { subjects: ['COMPUTER_SCIENCE', 'STATISTICS'] }
          : {}),
      }))
    )) as unknown as typeof fetch);
  const allowed = await invokeWorker(
    '/api/admin/academic-rules/honours/preview',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...selection,
        programme: 'STATISTICS',
        include: '801, 802',
      }),
    },
    env
  );
  expect(allowed.status).toBe(200);
  expect(
    HonoursPreviewResponseSchema.parse(await allowed.json()).counts
  ).toMatchObject({ planned_assign: 1, ineligible: 1 });
  expect(upstream).toHaveBeenCalledTimes(1);
});
