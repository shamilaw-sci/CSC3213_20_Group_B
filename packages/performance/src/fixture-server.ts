import { fixtureSessions } from '@/config/runtime';

export function startFixture(port = 47831) {
  const accounts = fixtureSessions(25);
  const names = new Map(accounts.map((s) => [s.cookie, s.originalName]));
  let requests = 0;
  const page = (title: string) =>
    new Response(
      `<!doctype html><html><head><title>Performance fixture</title></head><body><main><h1>${title}</h1><label>Search people<input type="search" aria-label="Search people" oninput="document.getElementById('results').hidden=false"></label><div id="results" hidden><a href="/people/perf-student-001">Perf Synthetic Student</a></div><a href="/browse">Browse projects</a></main></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port,
    async fetch(req) {
      requests++;
      const url = new URL(req.url);
      const path = url.pathname;
      const cookie = req.headers.get('cookie') ?? '';
      const account = accounts.find((s) => s.cookie === cookie);
      if (path === '/__perf/timeout') {
        await Bun.sleep(500);
        return Response.json({ mock: true });
      }
      if (/^\/__perf\/integrations\/(github|mailer|oauth)$/.test(path))
        return Response.json({ mock: true, externalCalls: 0 });
      if (path === '/favicon.ico')
        return new Response(new Uint8Array([0, 0, 1, 0]), {
          headers: { 'Content-Type': 'image/x-icon' },
        });
      if (path === '/people/v2/search.json')
        return Response.json([
          {
            id: 'perf-student-001',
            name: 'Perf Synthetic Student',
            href: '/people/perf-student-001',
            keywords: ['Synthetic', 'Perf'],
          },
        ]);
      if (path.startsWith('/api/')) {
        if (!account) return new Response('Unauthorized', { status: 401 });
        if (path === '/api/auth/get-session')
          return Response.json({
            user: { email: account.email },
            session: { id: account.id },
          });
        if (path === '/api/me') {
          if (req.method === 'PATCH') {
            let body: unknown;
            try {
              body = await req.json();
            } catch {
              return new Response('Invalid JSON', { status: 400 });
            }
            if (
              !body ||
              typeof body !== 'object' ||
              !('name' in body) ||
              typeof body.name !== 'string'
            )
              return new Response('Invalid name', { status: 400 });
            names.set(cookie, body.name.slice(0, 100));
            return Response.json({ name: names.get(cookie) });
          }
          return Response.json({
            email: account.email,
            name: names.get(cookie),
            role: 'student',
          });
        }
        if (path === '/api/projects/v2/projects/page') {
          if (url.searchParams.get('limit') === '0')
            return new Response('Invalid page limit', { status: 400 });
          const last = url.searchParams.has('cursor');
          return Response.json({
            version: 1,
            items: [{ slug: last ? 'perf-project-002' : 'perf-project-001' }],
            page: {
              nextCursor: last ? null : 'fixture-next',
              hasMore: !last,
              total: 2,
            },
          });
        }
        return new Response('Not found', { status: 404 });
      }
      if (path === '/' || path === '/browse' || path.startsWith('/search/'))
        return page('Performance fixture directory');
      if (path.startsWith('/people/perf-'))
        return page('Perf Synthetic Student');
      if (path.startsWith('/projects/perf-'))
        return page('Perf Synthetic Project');
      if (path === '/user/me')
        return account
          ? page(names.get(cookie)!)
          : new Response('Unauthorized', { status: 401 });
      return new Response('Not found', { status: 404 });
    },
  });
  return { server, names, accounts, requestCount: () => requests };
}

if (import.meta.main) {
  const fixture = startFixture();
  process.stdout.write(
    `Synthetic fixture listening on ${fixture.server.url.origin}; it does not run the applications or D1.\n`
  );
}
