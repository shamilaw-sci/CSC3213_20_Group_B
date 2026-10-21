import { afterEach, describe, expect, test } from 'bun:test';

import {
  ACCESS_LEVEL,
  APP_ROLE,
  setUserPermission,
} from '@/repositories/permissions.repo';
import type { Env } from '@/types/env';

import { createTestEnv } from 'test/helpers/create-test-env';
import { createTestSessionCookie } from 'test/helpers/create-test-session';
import { invokeWorker } from 'test/helpers/invoke-worker';

const ORIGIN = 'https://portal.scs-pdn.space';
const ADMIN_EMAIL = 'admin@pdn.ac.lk';
const ORIGINAL_FETCH = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

function project(slug: string) {
  return {
    id: `project-${slug}`,
    slug,
    title: slug,
    shortDescription: `${slug} summary`,
    description: `${slug} description`,
    projectType: 'OPEN_SOURCE',
    status: 'ACTIVE',
    categories: ['software'],
    people: [{ name: 'Student', role: 'student', email: 'student@pdn.ac.lk' }],
    source: { kind: 'MANUAL', curator: 'SCS' },
    media: { icon: 'Folder' },
    dates: { lastUpdatedAt: '2026-10-20' },
  };
}

describe('paginated list endpoint contracts', () => {
  test('retired compatibility routes remain unavailable', async () => {
    const env = createTestEnv();
    const cookie = await createTestSessionCookie(env, ADMIN_EMAIL);
    const request = (path: string) =>
      invokeWorker(
        path,
        {
          headers: {
            Cookie: cookie,
            Origin: ORIGIN,
            'X-Client-Id': 'portal',
          },
        },
        env
      );

    const [adminUsersResponse, projectsResponse, permissionsResponse] =
      await Promise.all([
        request('/api/admin/users'),
        request('/api/projects/v2/projects'),
        invokeWorker(
          '/api/user/permissions',
          {
            method: 'PATCH',
            headers: {
              Cookie: cookie,
              Origin: ORIGIN,
              'X-Client-Id': 'portal',
            },
          },
          env
        ),
      ]);

    expect(adminUsersResponse.status).toBe(404);
    expect(projectsResponse.status).toBe(404);
    expect(permissionsResponse.status).toBe(404);
  });

  test('registry page routes return bounded stable envelopes with scoped cursors', async () => {
    const env = createTestEnv();
    await setUserPermission(
      ADMIN_EMAIL,
      {
        role: APP_ROLE.ACADEMIC,
        accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
      },
      env
    );
    const cookie = await createTestSessionCookie(env, ADMIN_EMAIL);
    const projects = ['charlie', 'alpha', 'bravo'].map(project);
    const projectSummaries = projects.map(
      ({ id, slug, title, shortDescription }) => ({
        id,
        slug,
        title,
        shortDescription,
        projectType: 'OPEN_SOURCE',
        status: 'ACTIVE',
        categories: ['software'],
        tags: [],
        role: 'student',
        href: `projects/${slug}.json`,
        lastUpdatedAt: '2026-10-20',
      })
    );
    const courses = ['charlie', 'alpha', 'bravo'].map((id, index) => ({
      id,
      primaryCode: `CSC${3211 + index}`,
      codes: [`CSC${3211 + index}`],
      title: id,
      credits: 3,
    }));
    const offerings = ['charlie', 'alpha', 'bravo'].map((id) => ({
      id,
      courseId: 'alpha',
      academicYear: '2025/2026',
      semester: 'SEM1',
      staff: [],
    }));
    globalThis.fetch = Object.assign(
      async (input: string | URL | Request) => {
        const pathname = new URL(
          typeof input === 'string' || input instanceof URL ? input : input.url
        ).pathname;
        const value = pathname.includes('by-person')
          ? projectSummaries
          : pathname.includes('offerings')
            ? offerings
            : pathname.includes('courses')
              ? courses
              : projects;
        return Response.json(value);
      },
      { preconnect: ORIGINAL_FETCH.preconnect }
    );
    const headers = {
      Cookie: cookie,
      Origin: ORIGIN,
      'X-Client-Id': 'portal',
    };

    const projectResponse = await invokeWorker(
      '/api/projects/v2/projects/page?limit=2',
      { headers },
      env
    );
    const projectPage = (await projectResponse.json()) as {
      items: Array<{ slug: string }>;
      page: { nextCursor: string; hasMore: boolean; total: number };
    };
    expect(projectResponse.status).toBe(200);
    expect(projectPage.items.map(({ slug }) => slug)).toEqual([
      'alpha',
      'bravo',
    ]);
    expect(projectPage.page).toMatchObject({ hasMore: true, total: 3 });

    const studentEmail = 'student@pdn.ac.lk';
    await setUserPermission(studentEmail, { role: APP_ROLE.STUDENT }, env);
    const studentResponse = await invokeWorker(
      '/api/projects/v2/projects/page?limit=2',
      {
        headers: {
          ...headers,
          Cookie: await createTestSessionCookie(env, studentEmail),
        },
      },
      env
    );
    expect(studentResponse.status).toBe(200);
    expect(
      (
        (await studentResponse.json()) as { items: Array<{ slug: string }> }
      ).items.map(({ slug }) => slug)
    ).toEqual(['alpha', 'bravo']);

    const courseResponse = await invokeWorker(
      '/api/academic/v2/courses/page?limit=2',
      { headers },
      env
    );
    expect(courseResponse.status).toBe(200);
    expect(
      (
        (await courseResponse.json()) as { items: Array<{ id: string }> }
      ).items.map(({ id }) => id)
    ).toEqual(['alpha', 'bravo']);

    const offeringResponse = await invokeWorker(
      '/api/academic/v2/offerings/page?limit=2',
      { headers },
      env
    );
    expect(offeringResponse.status).toBe(200);

    const crossScope = await invokeWorker(
      `/api/academic/v2/courses/page?cursor=${encodeURIComponent(projectPage.page.nextCursor)}`,
      { headers },
      env
    );
    expect(crossScope.status).toBe(400);
  });
});
