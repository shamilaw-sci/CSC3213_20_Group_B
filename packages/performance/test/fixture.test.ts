import { expect, test } from 'bun:test';
import { plan } from 'test/support';

import { startFixture } from '@/fixture-server';
import { syntheticRequest } from '@/runner';

test('synthetic mutation requires identity and supports verified name restoration', async () => {
  const fixture = startFixture(0);
  try {
    const p = plan();
    p.target.origins.api = fixture.server.url.origin;
    const session = fixture.accounts[0];
    const anonymous = await fetch(`${fixture.server.url.origin}/api/me`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'wrong' }),
    });
    expect(anonymous.status).toBe(401);
    expect(await syntheticRequest(p, session, 'GET')).toBe(
      session.originalName
    );
    expect(
      await syntheticRequest(p, session, 'PATCH', 'Perf Synthetic changed')
    ).toBe('Perf Synthetic changed');
    expect(
      await syntheticRequest(p, session, 'PATCH', session.originalName)
    ).toBe(session.originalName);
    expect(await syntheticRequest(p, session, 'GET')).toBe(
      session.originalName
    );
  } finally {
    fixture.server.stop(true);
  }
});
