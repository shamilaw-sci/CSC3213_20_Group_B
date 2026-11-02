import { sleep } from 'k6';
import { SharedArray } from 'k6/data';
import exec from 'k6/execution';
import http from 'k6/http';
import { Counter, Gauge, Rate, Trend } from 'k6/metrics';

import type { Plan, Session } from '@/config/schema';

import {
  classify,
  type JourneyRequest,
  k6Options,
  phaseAt,
  responseValid,
  selectJourney,
} from './contracts.ts';
import { runJourney } from './journeys.ts';

// The Bun supervisor validates these private inputs before launching native k6.
const plan = JSON.parse(open(__ENV.PERF_PLAN_FILE)) as Plan;
const sessions = new SharedArray<Session>(
  'synthetic sessions',
  () => JSON.parse(open(__ENV.PERF_SESSIONS_FILE)) as Session[]
);
export const options = k6Options(plan);
const attempted = new Counter('perf_attempted');
const completed = new Counter('perf_completed');
const success = new Counter('perf_successful');
const latency = new Trend('perf_latency', true);
const failure = new Rate('perf_failure');
const started = new Counter('perf_iterations_started');
const journeys = new Counter('perf_journeys_completed');
const journeySuccess = new Rate('perf_journey_success');
const integrity = new Counter('perf_integrity');
const guardrail = new Counter('perf_guardrail');
const epoch = new Gauge('perf_epoch');
const runComplete = new Gauge('perf_run_complete');
let sent = 0;

export default function () {
  if (sent === 0) epoch.add(exec.scenario.startTime);
  if (exec.vu.idInTest > plan.vus) exec.test.abort('VU cap exceeded');
  const session = sessions[(exec.vu.idInTest - 1) % sessions.length];
  const iteration = exec.scenario.iterationInTest;
  const journey =
    plan.settings.journey === 'mixed'
      ? selectJourney(
          plan.settings.weights,
          (iteration * 37 + exec.vu.idInTest * 11) % 100
        )
      : plan.settings.journey;
  const phase = phaseAt(
    plan.phases,
    (Date.now() - exec.scenario.startTime) / 1000
  );
  const tags = { journey, phase };
  started.add(1, tags);
  integrity.add(0);
  guardrail.add(0);
  const request: JourneyRequest = (
    service,
    path,
    endpoint,
    kind,
    extra = {}
  ) => {
    if (++sent > Math.floor(plan.loadBudget / plan.vus)) {
      guardrail.add(1);
      exec.test.abort('Request budget exhausted');
    }
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
      guardrail.add(1);
      exec.test.abort('Invalid request path');
    }
    const origin = plan.target.origins[service]!;
    const headers: Record<string, string> = {
      'X-Client-Id': 'portal',
      Origin: plan.target.origins.portal!,
      'X-Performance-Run': plan.runId,
    };
    if (extra.auth && session && (service === 'api' || service === 'portal'))
      headers.Cookie = session.cookie;
    if (extra.body) headers['Content-Type'] = 'application/json';
    const revalidate =
      plan.settings.cache === 'revalidate' ||
      (plan.settings.cache === 'mixed' && iteration % 5 === 0);
    if (revalidate) headers['Cache-Control'] = 'no-cache';
    http.cookieJar().clear(origin);
    const requestTags = {
      ...tags,
      endpoint,
      name: endpoint,
      cache: revalidate ? 'revalidate' : 'normal',
    };
    attempted.add(1, requestTags);
    const expected = extra.expected || [200];
    const response = http.request(
      extra.method || 'GET',
      origin + path,
      extra.body ? JSON.stringify(extra.body) : null,
      {
        headers,
        redirects: 0,
        timeout: `${plan.settings.timeoutSeconds}s`,
        responseType: kind === 'none' ? 'none' : 'text',
        tags: requestTags,
        responseCallback: http.expectedStatuses(...expected),
      }
    );
    let data: unknown = response.body;
    if (!['none', 'html'].includes(kind)) {
      try {
        data = response.json();
      } catch {
        data = null;
      }
    }
    const classification = classify(
      response.status,
      response.error_code,
      expected,
      responseValid(kind, data, session)
    );
    const metricTags = { ...requestTags, classification };
    const ok = classification === 'ok';
    if (response.status > 0) completed.add(1, metricTags);
    if (ok) success.add(1, metricTags);
    latency.add(response.timings.duration, metricTags);
    failure.add(!ok && classification !== 'rate_limit_expected', metricTags);
    return { ok, data };
  };
  let ok = false;
  try {
    ok = runJourney(journey, request, plan, session, iteration);
  } catch {
    ok = false;
  }
  if (journey === 'updates' && !ok) integrity.add(1, tags);
  journeys.add(1, tags);
  journeySuccess.add(ok, tags);
  if (plan.settings.model === 'closed') {
    const [min, max] = plan.settings.thinkSeconds;
    sleep(min + (max - min) * (((iteration * 17) % 100) / 100));
  }
}

export function handleSummary() {
  return {};
}

export function teardown() {
  // Preserve the end of the scheduled window even when its final seconds are idle.
  runComplete.add(Date.now());
}
