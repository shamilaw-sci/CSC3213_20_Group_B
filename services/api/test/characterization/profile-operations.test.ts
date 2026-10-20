import { describe, expect, test } from 'bun:test';

import { APP_ROLE } from '@/repositories/permissions.repo';
import type { Env } from '@/types/env';

import { createTestEnv } from 'test/helpers/create-test-env';
import { createTestSessionCookie } from 'test/helpers/create-test-session';
import { invokeWorker } from 'test/helpers/invoke-worker';

const EMAIL = 'academic@pdn.ac.lk';
const OPERATION_ID = 'op_12345678901234567890';
type ServiceRequest = Parameters<NonNullable<Env['GITHUB_APP']>['fetch']>[0];

describe('profile operation compatibility', () => {
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
    await env.PERMISSIONS.put(
      `permissions:${EMAIL}`,
      JSON.stringify({ role: APP_ROLE.ACADEMIC, createdAt: 1 })
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
});
