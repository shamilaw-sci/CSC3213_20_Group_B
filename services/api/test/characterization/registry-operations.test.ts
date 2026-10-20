import { describe, expect, test } from 'bun:test';

import { APP_ROLE } from '@/repositories/permissions.repo';
import type { Env } from '@/types/env';

import { createTestEnv } from 'test/helpers/create-test-env';
import { createTestSessionCookie } from 'test/helpers/create-test-session';
import { invokeWorker } from 'test/helpers/invoke-worker';

const EMAIL = 'academic@pdn.ac.lk';
const OPERATION_ID = 'op_12345678901234567890';
type ServiceRequest = Parameters<NonNullable<Env['GITHUB_APP']>['fetch']>[0];

async function setup() {
  const upstream: Array<{ path: string; body: Promise<unknown> }> = [];
  const env = createTestEnv({
    GITHUB_APP: {
      fetch: (request: ServiceRequest) => {
        const received =
          request instanceof Request ? request : new Request(request);
        upstream.push({
          path: new URL(received.url).pathname,
          body: received
            .clone()
            .json()
            .catch(() => null),
        });
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
  return { env, headers, upstream };
}

describe('registry operation compatibility', () => {
  test('submits projects with an entity revision and project resource key', async () => {
    const { env, headers, upstream } = await setup();
    const response = await invokeWorker(
      '/api/projects/v2/projects/example-project/pr',
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          project: {
            id: 'project-example',
            slug: 'example-project',
            title: 'Example Project',
            shortDescription: 'An example project.',
            description: 'An example project for operation testing.',
            projectType: 'OPEN_SOURCE',
            status: 'ACTIVE',
            categories: ['software'],
            tags: [],
            departments: ['STATISTICS_AND_COMPUTER_SCIENCE'],
            people: [
              {
                name: 'Academic User',
                role: 'maintainer',
                email: EMAIL,
                username: 'academic',
              },
            ],
            links: {},
            source: { kind: 'MANUAL', curator: 'SCS' },
            media: { icon: 'FolderKanban' },
            dates: { lastUpdatedAt: '2026-10-19' },
          },
          control: {
            idempotencyKey: 'request-key-00000001',
            expectedRevision: 'old-project-blob',
          },
        }),
      },
      env
    );

    expect(response.status).toBe(202);
    expect(upstream[0]?.path).toBe('/projects/public-project/operations');
    expect(await upstream[0]!.body).toMatchObject({
      action: 'upsert',
      idempotencyKey: 'request-key-00000001',
      request: {
        slug: 'example-project',
        expectedRevision: 'old-project-blob',
      },
    });
  });

  test('submits courses with an entity revision and course resource key', async () => {
    const { env, headers, upstream } = await setup();
    const response = await invokeWorker(
      '/api/academic/v2/courses/co321/pr',
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          course: {
            id: 'co321',
            primaryCode: 'CSC3213',
            codes: ['CSC3213'],
            title: 'Software Engineering',
            credits: 3,
            departments: ['STATISTICS_AND_COMPUTER_SCIENCE'],
          },
          control: {
            idempotencyKey: 'request-key-00000002',
            expectedRevision: 'old-course-blob',
          },
        }),
      },
      env
    );

    expect(response.status).toBe(202);
    expect(upstream[0]?.path).toBe('/academic/public-course/operations');
    expect(await upstream[0]!.body).toMatchObject({
      operation: 'course.upsert',
      idempotencyKey: 'request-key-00000002',
      request: { id: 'co321', expectedRevision: 'old-course-blob' },
    });
  });
});
