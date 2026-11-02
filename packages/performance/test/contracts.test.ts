import {
  classify,
  k6Options,
  responseValid,
  selectJourney,
} from '@k6/contracts.ts';
import { runJourney } from '@k6/journeys.ts';
import { expect, test } from 'bun:test';
import { plan } from 'test/support';

test('classifies network, assertion and expected/unexpected HTTP outcomes', () => {
  expect(classify(0, 1050, [200], true)).toBe('timeout');
  expect(classify(0, 1000, [200], true)).toBe('connection');
  expect(classify(503, 0, [200], true)).toBe('http_5xx');
  expect(classify(429, 0, [200, 429], true)).toBe('rate_limit_expected');
  expect(classify(429, 0, [200], true)).toBe('http_4xx');
  expect(classify(200, 0, [200], false)).toBe('assertion');
  expect(responseValid('session', null, undefined)).toBe(false);
  expect(
    responseValid(
      'page',
      { version: 1, items: [], page: { nextCursor: null, hasMore: false } },
      undefined
    )
  ).toBe(true);
});
test('uses arrival executors, fixed VU allocation, no redirects and bounded tags', () => {
  const open = k6Options(plan({ model: 'open' }));
  expect(open.scenarios.load.executor).toBe('ramping-arrival-rate');
  expect(open.scenarios.load.maxVUs).toBe(2);
  expect(open.maxRedirects).toBe(0);
  expect(open.systemTags).not.toContain('url');
  expect(open.systemTags).not.toContain('error');
});
test('workload distribution follows configured percentages', () => {
  const p = plan();
  const counts: Record<string, number> = {};
  for (let i = 0; i < 100; i++) {
    const name = selectJourney(p.settings.weights, i);
    counts[name] = (counts[name] ?? 0) + 1;
  }
  expect(counts).toEqual(p.settings.weights);
});

test('k6 accepts zero failures and perfect journey success as inclusive boundary SLOs', () => {
  const options = k6Options(
    plan({
      slo: { failureRate: 0, journeySuccessRate: 1 },
      endpointSlo: { web_home: { failureRate: 0 } },
    })
  );
  expect(options.thresholds.perf_failure).toEqual(['rate<=0']);
  expect(options.thresholds.perf_journey_success).toEqual(['rate>=1']);
  expect(options.thresholds['perf_failure{endpoint:web_home}']).toEqual([
    'rate<=0',
  ]);
});
test('negative validation never submits a Git-backed mutation or sends mail', () => {
  const paths: string[] = [];
  runJourney(
    'validation',
    (_service: string, path: string) => {
      paths.push(path);
      return { ok: true };
    },
    plan(),
    undefined,
    0
  );
  expect(paths).toEqual(['/api/me', '/api/projects/v2/projects/page?limit=0']);
});
