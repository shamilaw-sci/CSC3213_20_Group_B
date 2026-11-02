import type { Plan, Session } from '@/config/schema';

import { type JourneyRequest, responseRecord } from './contracts.ts';

export function runJourney(
  name: string,
  request: JourneyRequest,
  plan: Plan,
  session: Session | undefined,
  iteration: number
): boolean {
  const identity =
    plan.fixtures.identities[iteration % plan.fixtures.identities.length];
  const project =
    plan.fixtures.projectSlugs[iteration % plan.fixtures.projectSlugs.length];
  const query =
    plan.fixtures.searchQueries[iteration % plan.fixtures.searchQueries.length];
  if (name === 'people') {
    return (
      request('people', '/', 'people_home', 'html').ok &&
      request('people', `/people/${identity}`, 'people_profile', 'html').ok
    );
  }
  if (name === 'search') {
    // People filters this index in the browser; HTTP traffic alone does not measure search interaction.
    return (
      request('people', '/', 'people_home', 'html').ok &&
      request('data', '/people/v2/search.json', 'people_search_index', 'array')
        .ok
    );
  }
  if (name === 'projects') {
    return (
      request('projects', '/browse', 'projects_browse', 'html').ok &&
      request(
        'projects',
        `/search/${encodeURIComponent(query.toLowerCase())}`,
        'projects_search',
        'html'
      ).ok &&
      request('projects', `/projects/${project}`, 'project_detail', 'html').ok
    );
  }
  if (name === 'portal') {
    return (
      request('api', '/api/auth/get-session', 'session', 'session', {
        auth: true,
      }).ok &&
      request('portal', '/user/me', 'portal', 'html', { auth: true }).ok &&
      request('api', '/api/me', 'me', 'me', { auth: true }).ok
    );
  }
  if (name === 'updates') {
    if (!session) return false;
    const before = request('api', '/api/me', 'me', 'me', { auth: true });
    if (!before.ok) return false;
    const name = `Perf Synthetic load ${session.id}`;
    const update = request('api', '/api/me', 'profile_update', 'update', {
      auth: true,
      method: 'PATCH',
      body: { name },
    });
    const after = request('api', '/api/me', 'profile_verify', 'me', {
      auth: true,
    });
    return update.ok && after.ok && responseRecord(after.data).name === name;
  }
  if (name === 'pagination') {
    const first = request(
      'api',
      '/api/projects/v2/projects/page?limit=2',
      'projects_page',
      'page',
      { auth: true }
    );
    if (!first.ok) return false;
    const page = responseRecord(responseRecord(first.data).page);
    if (!page.hasMore) return true;
    const cursor = page.nextCursor;
    if (typeof cursor !== 'string' || cursor.length > 2048) return false;
    return request(
      'api',
      `/api/projects/v2/projects/page?limit=2&cursor=${encodeURIComponent(cursor)}`,
      'projects_page',
      'page',
      { auth: true }
    ).ok;
  }
  if (name === 'validation') {
    return (
      request('api', '/api/me', 'invalid_profile', 'none', {
        auth: true,
        method: 'PATCH',
        body: { name: null },
        expected: [400],
      }).ok &&
      request(
        'api',
        '/api/projects/v2/projects/page?limit=0',
        'invalid_page',
        'none',
        { auth: true, expected: [400] }
      ).ok
    );
  }
  if (name === 'authorization')
    return request('api', '/api/me', 'unauthorized', 'none', {
      expected: [401],
    }).ok;
  if (name === 'rate-limit')
    return request('api', '/api/auth/get-session', 'rate_limit', 'session', {
      auth: true,
      expected: [200, 429],
    }).ok;
  if (name === 'timeout')
    return request('api', '/__perf/timeout', 'timeout_probe', 'none', {
      expected: [200],
    }).ok;
  if (name === 'integrations') {
    return ['github', 'mailer', 'oauth'].every(
      (integration) =>
        request(
          'api',
          `/__perf/integrations/${integration}`,
          `mock_${integration}`,
          'mock'
        ).ok
    );
  }
  if (name === 'home') return request('web', '/', 'web_home', 'html').ok;
  if (name === 'static')
    return request('web', '/favicon.ico', 'static', 'none').ok;
  return (
    request('web', '/', 'web_home', 'html').ok &&
    request('docs', '/', 'docs_home', 'html').ok &&
    request('web', '/favicon.ico', 'static', 'none').ok
  );
}
