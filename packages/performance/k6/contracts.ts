import type { Options } from 'k6/options';

import type { Phase, Plan, Session } from '@/config/schema';

export type ResponseKind =
  'none' | 'html' | 'array' | 'me' | 'session' | 'update' | 'page' | 'mock';
export type JourneyRequest = (
  service: keyof Plan['target']['origins'],
  path: string,
  endpoint: string,
  kind: ResponseKind,
  extra?: {
    auth?: boolean;
    method?: string;
    body?: Record<string, unknown>;
    expected?: number[];
  }
) => { ok: boolean; data?: unknown };

export function responseRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function classify(
  status: number,
  errorCode: number,
  expected: number[],
  valid: boolean
) {
  if (status === 0) return errorCode === 1050 ? 'timeout' : 'connection';
  if (status === 429)
    return expected.includes(429) ? 'rate_limit_expected' : 'http_4xx';
  if (status >= 500) return 'http_5xx';
  if (!expected.includes(status))
    return status >= 400 ? 'http_4xx' : 'unexpected_status';
  return valid ? 'ok' : 'assertion';
}

export function responseValid(
  kind: ResponseKind,
  value: unknown,
  session: Session | undefined
) {
  if (kind === 'none') return true;
  if (kind === 'html')
    return typeof value === 'string' && /<(?:!doctype|html)/i.test(value);
  if (kind === 'array') return Array.isArray(value);
  if (!value || typeof value !== 'object') return false;
  const data = responseRecord(value);
  if (kind === 'me')
    return (
      data.email === session?.email &&
      typeof data.name === 'string' &&
      typeof data.role === 'string'
    );
  if (kind === 'session')
    return (
      responseRecord(data.user).email === session?.email &&
      typeof responseRecord(data.session).id === 'string'
    );
  if (kind === 'update')
    return data.name === `Perf Synthetic load ${session?.id}`;
  if (kind === 'page')
    return (
      data.version === 1 &&
      Array.isArray(data.items) &&
      data.items.length <= 2 &&
      typeof responseRecord(data.page).hasMore === 'boolean' &&
      (responseRecord(data.page).nextCursor === null ||
        typeof responseRecord(data.page).nextCursor === 'string')
    );
  if (kind === 'mock') return data.mock === true && data.externalCalls === 0;
  return false;
}

export function selectJourney(
  weights: Plan['settings']['weights'],
  value: number
) {
  let cumulative = 0;
  for (const [name, weight] of Object.entries(weights)) {
    cumulative += weight;
    if (value < cumulative) return name;
  }
  return 'safe';
}

export function phaseAt(phases: Phase[], elapsed: number) {
  let end = 0;
  for (const phase of phases) {
    end += phase.seconds;
    if (elapsed < end) return phase.name;
  }
  return 'drain';
}

export function k6Options(plan: Plan) {
  const stages = plan.phases.map((p) => ({
    duration: `${p.seconds}s`,
    target: p.target,
  }));
  const start = ['spike', 'recovery'].includes(plan.profile)
    ? plan.phases[0].target
    : 1;
  const scenario =
    plan.settings.model === 'open'
      ? {
          executor: 'ramping-arrival-rate' as const,
          startRate: start,
          timeUnit: '1s',
          preAllocatedVUs: plan.vus,
          maxVUs: plan.vus,
          stages,
        }
      : {
          executor: 'ramping-vus' as const,
          startVUs: start,
          stages,
          gracefulRampDown: '15s',
        };
  const thresholds: Record<string, string[]> = {
    perf_latency: [
      `p(95)<${plan.settings.slo.p95Ms}`,
      `p(99)<${plan.settings.slo.p99Ms}`,
    ],
    perf_failure: [
      `rate${plan.settings.slo.failureRate === 0 ? '<=' : '<'}${plan.settings.slo.failureRate}`,
    ],
    perf_journey_success: [
      `rate${plan.settings.slo.journeySuccessRate === 1 ? '>=' : '>'}${plan.settings.slo.journeySuccessRate}`,
    ],
    perf_integrity: ['count==0'],
    perf_guardrail: ['count==0'],
  };
  for (const [endpoint, slo] of Object.entries(plan.settings.endpointSlo)) {
    thresholds[`perf_latency{endpoint:${endpoint}}`] = [
      `p(95)<${slo.p95Ms}`,
      `p(99)<${slo.p99Ms}`,
    ];
    thresholds[`perf_failure{endpoint:${endpoint}}`] = [
      `rate${slo.failureRate === 0 ? '<=' : '<'}${slo.failureRate}`,
    ];
  }
  return {
    scenarios: { load: { ...scenario, gracefulStop: '15s' } },
    thresholds,
    // RPS is a last-resort safety ceiling; arrivals, not this limiter, define the workload.
    rps: plan.maxRps,
    maxRedirects: 0,
    noCookiesReset: true,
    systemTags: ['method', 'status', 'name', 'scenario', 'error_code'],
    summaryTrendStats: [
      'avg',
      'min',
      'max',
      'p(50)',
      'p(90)',
      'p(95)',
      'p(99)',
    ],
    discardResponseBodies: true,
    userAgent: 'SCS-Performance/1.0',
  } satisfies Options;
}
