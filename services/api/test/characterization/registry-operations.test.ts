import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

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
const ownerProject = {
  id: 'example-project',
  slug: 'example-project',
  title: 'Example Project',
  shortDescription: 'An example project.',
  description: 'An example project for index comparison.',
  projectType: 'OPEN_SOURCE',
  status: 'ACTIVE',
  categories: ['software'],
  tags: [],
  people: [
    {
      name: 'Academic User',
      role: 'maintainer',
      email: EMAIL,
      username: 'academic',
    },
  ],
  links: {},
  source: {
    kind: 'TEMPLATE_INDEX_JSON',
    repositoryOwner: 'scs-pdn',
    repositoryName: 'example',
    metadataPath: '.docs/index.json',
    indexUrl:
      'https://api.github.com/repos/scs-pdn/example/contents/.docs/index.json',
  },
  media: {},
  dates: { lastUpdatedAt: '2026-11-03' },
};
const originalFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = ((input, init) => {
    if (
      String(input).startsWith(
        'https://data.test.scs-pdn.space/projects/v2/projects/'
      )
    ) {
      return Promise.resolve(new Response(null, { status: 404 }));
    }
    return originalFetch(input, init);
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});
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
  return { env, headers, upstream };
}

describe('registry operation compatibility', () => {
  test('publishes the repository index JSON Schema without a session', async () => {
    const response = await invokeWorker(
      '/api/projects/v2/schemas/index.json',
      {
        method: 'GET',
      },
      createTestEnv()
    );
    const schema = (await response.json()) as {
      $id: string;
      additionalProperties: boolean;
      properties: Record<string, unknown>;
    };
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain(
      'application/schema+json'
    );
    expect(schema.$id).toBe(
      'https://api.scs-pdn.space/api/projects/v2/schemas/index.json'
    );
    expect(schema.additionalProperties).toBeFalse();
    expect(schema.properties.$schema).toBeDefined();
    expect(schema.properties.id).toBeUndefined();
    expect(schema.properties.slug).toBeUndefined();
  });
  test('rejects a non-admin project ID override at creation', async () => {
    const { env, headers, upstream } = await setup();
    const response = await invokeWorker(
      '/api/projects/v2/projects/example-project/pr',
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({ project: { ...ownerProject, id: 'custom-id' } }),
      },
      env
    );
    expect(response.status).toBe(403);
    expect(upstream).toHaveLength(0);
  });

  test('requires a title-derived slug for a new owner submission', async () => {
    const { env, headers, upstream } = await setup();
    const response = await invokeWorker(
      '/api/projects/v2/projects/example-project/pr',
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({ project: ownerProject }),
      },
      env
    );
    expect(response.status).toBe(403);
    expect(upstream).toHaveLength(0);
  });

  test('checks ownership against the published project, not the submitted people list', async () => {
    const { env, headers, upstream } = await setup();
    const fallbackFetch = globalThis.fetch;
    globalThis.fetch = ((input, init) =>
      String(input).startsWith(
        'https://data.test.scs-pdn.space/projects/v2/projects/'
      )
        ? Promise.resolve(
            Response.json({
              ...ownerProject,
              people: [
                {
                  name: 'Another Owner',
                  role: 'maintainer',
                  username: 'another',
                },
              ],
            })
          )
        : fallbackFetch(input, init)) as typeof fetch;
    const response = await invokeWorker(
      '/api/projects/v2/projects/example-project/pr',
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({ project: ownerProject }),
      },
      env
    );
    expect(response.status).toBe(403);
    expect(upstream).toHaveLength(0);
  });

  test('compares repository data without accepting its ID or slug', async () => {
    const { env, headers } = await setup();
    const fallbackFetch = globalThis.fetch;
    const content = btoa(
      JSON.stringify({
        $schema: 'https://api.scs-pdn.space/api/projects/v2/schemas/index.json',
        title: 'Repository title',
        people: [
          { name: 'New Person', role: 'contributor', username: 'newperson' },
        ],
      })
    );
    globalThis.fetch = ((input, init) =>
      String(input).startsWith('https://api.github.com/')
        ? Promise.resolve(Response.json({ content }))
        : fallbackFetch(input, init)) as typeof fetch;
    const response = await invokeWorker(
      '/api/projects/v2/projects/example-project/source-preview',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ project: ownerProject }),
      },
      env
    );
    const preview = (await response.json()) as {
      project: Record<string, unknown>;
      changedFields: string[];
    };
    expect(response.status).toBe(200);
    expect(preview.project).toMatchObject({
      id: 'example-project',
      slug: 'example-project',
      title: 'Repository title',
    });
    expect(preview.changedFields).toContain('people');
  });
  test('accepts a catalog course without an offering and checks offering ownership', async () => {
    const { env, headers, upstream } = await setup();
    await setUserPermission(
      EMAIL,
      {
        role: APP_ROLE.ACADEMIC,
        accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
        createdAt: 1,
      },
      env
    );
    const fallbackFetch = globalThis.fetch;
    globalThis.fetch = ((input, init) => {
      const url = String(input);
      if (url.endsWith('/academic/v2/courses.json'))
        return Promise.resolve(
          Response.json([
            {
              id: 'course-a',
              primaryCode: 'CSC3213',
              codes: ['CSC3213'],
              title: 'Course A',
              credits: 3,
              departments: [],
            },
          ])
        );
      if (url.endsWith('/academic/v2/offerings.json'))
        return Promise.resolve(
          Response.json([
            {
              id: 'other-course-2025-2026-sem1',
              courseId: 'other-course',
              academicYear: '2025/2026',
              semester: 'SEM1',
              staff: [],
              departments: [],
            },
          ])
        );
      return fallbackFetch(input, init);
    }) as typeof fetch;
    const project = {
      ...ownerProject,
      projectType: 'COURSE_PROJECT',
      course: {
        courseId: 'course-a',
        code: 'CSC3213',
        title: 'Course A',
      },
    };

    const withoutOffering = await invokeWorker(
      '/api/projects/v2/projects/example-project/pr',
      { method: 'PUT', headers, body: JSON.stringify({ project }) },
      env
    );
    expect(withoutOffering.status).toBe(202);
    expect(upstream).toHaveLength(1);

    const wrongOffering = await invokeWorker(
      '/api/projects/v2/projects/example-project/pr',
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          project: {
            ...project,
            courseOffering: { id: 'other-course-2025-2026-sem1' },
          },
        }),
      },
      env
    );
    expect(wrongOffering.status).toBe(400);
    expect(upstream).toHaveLength(1);
  });
  test('submits projects with an entity revision and project resource key', async () => {
    const { env, headers, upstream } = await setup();
    const response = await invokeWorker(
      '/api/projects/v2/projects/example-project-a1b2c3/pr',
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          project: {
            id: 'example-project-a1b2c3',
            slug: 'example-project-a1b2c3',
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
            expectedRevision: 'missing',
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
        slug: 'example-project-a1b2c3',
        expectedRevision: 'missing',
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
