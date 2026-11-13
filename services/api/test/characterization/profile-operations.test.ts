import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { submitPublicProfileOperationRequestSchema } from '@scs/schemas';

import {
  ACCESS_LEVEL,
  APP_ROLE,
  setUserPermission,
} from '@/repositories/permissions.repo';
import type { Env } from '@/types/env';

import { createTestEnv } from 'test/helpers/create-test-env';
import { createTestSessionCookie } from 'test/helpers/create-test-session';
import { invokeWorker } from 'test/helpers/invoke-worker';

const EMAIL = 'academic@pdn.ac.lk';
const OPERATION_ID = 'op_12345678901234567890';
type ServiceRequest = Parameters<NonNullable<Env['GITHUB_APP']>['fetch']>[0];

afterEach(() => {
  (globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.();
});

describe('profile operation compatibility', () => {
  test('rejects a super-admin attempt to reclassify a student-pattern account', async () => {
    const studentEmail = 's21513@sci.pdn.ac.lk';
    const adminEmail = 'admin@sci.pdn.ac.lk';
    const env = createTestEnv();
    await setUserPermission(studentEmail, { role: APP_ROLE.STUDENT }, env);
    await setUserPermission(
      adminEmail,
      { role: APP_ROLE.OTHER, accessLevel: ACCESS_LEVEL.SUPER_ADMIN },
      env
    );
    const response = await invokeWorker(
      `/api/admin/users/${encodeURIComponent(studentEmail)}`,
      {
        method: 'PATCH',
        headers: {
          Origin: 'https://portal.scs-pdn.space',
          'X-Client-Id': 'portal',
          Cookie: await createTestSessionCookie(env, adminEmail),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'ACADEMIC' }),
      },
      env
    );
    expect(response.status).toBe(409);
  });

  test('rejects student self-service Honours assignment before dispatch', async () => {
    const studentEmail = 's21513@sci.pdn.ac.lk';
    const upstreamBodies: unknown[] = [];
    spyOn(globalThis, 'fetch').mockImplementation(
      (async () =>
        new Response(null, { status: 404 })) as unknown as typeof fetch
    );
    const env = createTestEnv({
      GITHUB_APP: {
        fetch: async (request: ServiceRequest) => {
          upstreamBodies.push(request);
          return new Response(null, { status: 500 });
        },
      } as NonNullable<Env['GITHUB_APP']>,
    });
    await setUserPermission(studentEmail, { role: APP_ROLE.STUDENT }, env);
    const response = await invokeWorker(
      '/api/people/v2/me/pr',
      {
        method: 'PUT',
        headers: {
          Origin: 'https://portal.scs-pdn.space',
          'X-Client-Id': 'portal',
          Cookie: await createTestSessionCookie(env, studentEmail),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profileKind: 'student',
          profile: {
            registrationNo: 'S21513',
            studentTrack: 'HONOURS',
            honoursProgramme: 'COMPUTER_SCIENCE',
          },
        }),
      },
      env
    );
    expect(response.status).toBe(403);
    expect(upstreamBodies).toHaveLength(0);
  });

  test('opts the Portal into async profile submission and proxies status', async () => {
    const upstream: Array<{
      url: string;
      headers: Headers;
      body: Promise<unknown>;
    }> = [];
    const env = createTestEnv({
      GITHUB_APP: {
        fetch: (request: ServiceRequest) => {
          const received =
            request instanceof Request ? request : new Request(request);
          upstream.push({
            url: received.url,
            headers: new Headers(received.headers),
            body: received
              .clone()
              .json()
              .catch(() => null),
          });
          const path = new URL(received.url).pathname;
          if (path === '/people/public-profile/operations') {
            return Promise.resolve(
              Response.json(
                {
                  version: 1,
                  operationId: OPERATION_ID,
                  status: 'queued',
                  statusUrl: `/api/operations/${OPERATION_ID}`,
                  retryAfterMs: 500,
                },
                { status: 202 }
              )
            );
          }
          return Promise.resolve(
            Response.json({
              version: 1,
              operationId: OPERATION_ID,
              resource: { type: 'profile', id: 'academic' },
              actor: {
                type: 'user',
                subjectId: received.headers.get('X-Actor-Subject-Id'),
              },
              createdAt: '2026-10-19T00:00:00.000Z',
              updatedAt: '2026-10-19T00:00:01.000Z',
              completedAt: '2026-10-19T00:00:01.000Z',
              status: 'succeeded',
              outcome: { status: 'succeeded', revision: 'new-user-blob' },
            })
          );
        },
      } as unknown as NonNullable<Env['GITHUB_APP']>,
    });
    await setUserPermission(
      EMAIL,
      { role: APP_ROLE.ACADEMIC, createdAt: 1 },
      env
    );
    const sessionCookie = await createTestSessionCookie(env, EMAIL);
    const headers = {
      Origin: 'https://portal.scs-pdn.space',
      'X-Client-Id': 'portal',
      Cookie: sessionCookie,
      'Content-Type': 'application/json',
      Prefer: 'respond-async',
    };
    const submit = await invokeWorker(
      '/api/people/v2/me/pr',
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          profileKind: 'academic',
          profile: {
            title: 'Dr',
            fullName: 'Academic User',
            email: EMAIL,
            staffType: 'ACADEMIC_TEACHING',
            academicRank: 'LECTURER',
          },
          control: {
            idempotencyKey: 'request-key-00000001',
            expectedRevision: 'old-user-blob',
          },
        }),
      },
      env
    );

    expect(submit.status).toBe(202);
    expect(await submit.json()).toMatchObject({ operationId: OPERATION_ID });
    const submittedBody = await upstream[0]!.body;
    expect(submittedBody).toMatchObject({
      idempotencyKey: 'request-key-00000001',
      request: { expectedRevision: 'old-user-blob' },
    });

    const status = await invokeWorker(
      `/api/operations/${OPERATION_ID}`,
      { headers },
      env
    );
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({
      status: 'succeeded',
      outcome: { revision: 'new-user-blob' },
    });
    expect(upstream[1]!.headers.get('X-Actor-Subject-Id')).toMatch(/^usr_/);
  });

  test('submits the canonical honours directory path accepted by the GitHub App schema', async () => {
    const studentEmail = 's21513@sci.pdn.ac.lk';
    const upstreamBodies: unknown[] = [];
    const publicDataFetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/student-placement.json')) {
        return Response.json([
          { batch: 's21', studentTrack: 'HONOURS', level: '3000' },
        ]);
      }
      if (
        url.includes('/alumni.json') ||
        url.includes('/postgraduate-programmes.json')
      ) {
        return Response.json([]);
      }
      if (url.includes('/student-streams.json')) {
        return Response.json([
          {
            stream: 'computer-science',
            label: 'Computer Science',
            directory: 'computer-science',
            publicDirectory: true,
          },
        ]);
      }
      return new Response(null, { status: 404 });
    };
    spyOn(globalThis, 'fetch').mockImplementation(
      publicDataFetch as typeof fetch
    );
    const env = createTestEnv({
      GITHUB_APP: {
        fetch: async (request: ServiceRequest) => {
          const received =
            request instanceof Request ? request : new Request(request);
          const body = await received.json();
          upstreamBodies.push(body);
          const parsed =
            submitPublicProfileOperationRequestSchema.safeParse(body);
          if (!parsed.success) {
            const issue = parsed.error.issues[0];
            return Response.json(
              {
                success: false,
                message: 'Invalid request',
                field: issue?.path.join('.'),
                reason: issue?.message,
              },
              { status: 400 }
            );
          }
          return Response.json(
            {
              version: 1,
              operationId: OPERATION_ID,
              status: 'queued',
              statusUrl: `/api/operations/${OPERATION_ID}`,
              retryAfterMs: 500,
            },
            { status: 202 }
          );
        },
      } as NonNullable<Env['GITHUB_APP']>,
    });
    await setUserPermission(
      studentEmail,
      { role: APP_ROLE.STUDENT, createdAt: 1 },
      env
    );
    const adminEmail = 'admin@sci.pdn.ac.lk';
    await setUserPermission(
      adminEmail,
      { role: APP_ROLE.OTHER, accessLevel: ACCESS_LEVEL.SUPER_ADMIN },
      env
    );
    const sessionCookie = await createTestSessionCookie(env, adminEmail);

    const response = await invokeWorker(
      `/api/people/v2/admin/users/${encodeURIComponent(studentEmail)}/pr`,
      {
        method: 'PUT',
        headers: {
          Origin: 'https://portal.scs-pdn.space',
          'X-Client-Id': 'portal',
          Cookie: sessionCookie,
          'Content-Type': 'application/json',
          Prefer: 'respond-async',
        },
        body: JSON.stringify({
          profileKind: 'student',
          profile: {
            title: 'Mr',
            fullName: 'Student User',
            email: studentEmail,
            registrationNo: 'S21513',
            studentType: 'UNDERGRADUATE',
            studentTrack: 'HONOURS',
            level: '3000',
            honoursProgramme: 'COMPUTER_SCIENCE',
            status: 'CURRENT',
          },
          control: {
            idempotencyKey: 'request-key-00000002',
            expectedRevision: 'old-user-blob',
          },
        }),
      },
      env
    );

    expect(response.status).toBe(202);
    expect(upstreamBodies[0]).toMatchObject({
      request: {
        aggregatePaths: [
          'public/people/v2/students/s21.json',
          'public/people/v2/special/computer-science/s21.json',
        ],
      },
    });
  });
});
