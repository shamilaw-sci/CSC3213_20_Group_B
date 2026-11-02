import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type {
  InfrastructureMetrics,
  ProviderTelemetry,
} from '@/config/artifacts';
import type { Plan } from '@/config/schema';
import {
  evaluate,
  type MetricsCollector,
  WindowMetrics,
} from '@/reporters/metrics';

export type RunState = {
  engine: 'k6' | 'playwright';
  startedAt: string;
  finishedAt: string;
  exitCode: number;
  reason: string | null;
  cleanup: 'not-needed' | 'passed' | 'failed';
  cleanupFailedIds: string[];
  preparationRequests: number;
  cleanupRequests: number;
  generator: {
    samples: number;
    maxCpuRatio: number | null;
    minFreeMemoryRatio: number | null;
    maxTimerLagMs: number | null;
    saturated: boolean;
  };
};

export function createReport(
  plan: Plan,
  collector: MetricsCollector,
  state: RunState
) {
  const infrastructure: InfrastructureMetrics = {
    workerRequests: null,
    workerCpuMs: null,
    d1QueryMs: null,
    d1RowsRead: null,
    d1RowsWritten: null,
    vercelFunctionMs: null,
    vercelErrors: null,
    thirdPartyFailures: null,
    actualCost: null,
  };
  const duration = Math.max(
    0.001,
    collector.lastTime ||
      (Date.parse(state.finishedAt) - Date.parse(state.startedAt)) / 1000
  );
  const metrics = collector.total.summary(duration);
  const thresholds = evaluate(
    metrics,
    plan.settings.slo,
    plan.settings.endpointSlo
  );
  const invalid: string[] = [];
  if (state.reason) invalid.push(state.reason);
  if (state.exitCode !== 0 && state.exitCode !== 99)
    invalid.push('Load generator did not complete normally');
  if (
    collector.epoch === null ||
    metrics.attempted === 0 ||
    metrics.latency.count === 0
  )
    invalid.push('No complete measurement stream');
  if (metrics.attempted !== metrics.latency.count)
    invalid.push(
      'Started HTTP requests lack completion or failure measurements'
    );
  if (collector.malformed) invalid.push('Malformed or truncated metric points');
  if (state.engine === 'k6' && !collector.runComplete)
    invalid.push(
      'Missing load-completion marker; the measurement window is incomplete'
    );
  if (metrics.guardrailEvents) invalid.push('Safety guardrail reached');
  if ((metrics.droppedRate ?? 0) > plan.settings.maxDroppedRate)
    invalid.push(
      'Excessive dropped iterations; distinguish generator sizing from SUT slowdown'
    );
  if (state.generator.saturated)
    invalid.push('Load-generator saturation observed');
  if (state.cleanup === 'failed')
    invalid.push('Synthetic cleanup or verification failed');
  if (
    metrics.attempted + state.preparationRequests + state.cleanupRequests >
    plan.requestBudget
  )
    invalid.push('Request budget exceeded');
  const buckets = [...collector.buckets]
    .sort(([a], [b]) => a - b)
    .map(([second, m]) => ({
      second,
      ...m.summary(Math.max(0.001, Math.min(10, duration - second))),
    }));
  if (
    buckets.some((b) => b.seconds >= 9 && b.attemptedRps >= plan.maxRps * 0.9)
  )
    invalid.push(
      'Traffic approached the RPS safety ceiling; limiter may distort results'
    );
  const phases = plan.phases.map((phase) => {
    const measured = (
      collector.phases.get(phase.name) ?? new WindowMetrics()
    ).summary(phase.seconds);
    return {
      ...phase,
      metrics: measured,
      thresholds: evaluate(
        measured,
        plan.settings.slo,
        plan.settings.endpointSlo
      ),
    };
  });
  const confidenceLimits = [
    'Latency percentiles use conservative logarithmic bins: at most 1% plus 0.01 ms rounding error; averages and extrema are exact.',
    'DNS duration is not separately exposed by k6 HTTP. Blocked time includes connection-slot and DNS work and is not a DNS measurement.',
    'VUs are simulated users, not a count of real people. Shared read sessions, cache locality and one generator IP can affect authentication limits.',
    'Infrastructure CPU, D1 query timings/rows, queue depth, Vercel duration/errors and billed cost require provider telemetry; they are not inferred from HTTP latency.',
    'Cache mode requests normal caching or revalidation; it does not prove cache HIT/MISS or create an uncached deployment.',
    'Generator CPU/free-memory samples cover the whole host. NIC throughput, file descriptors and disk contention need operator monitoring.',
    'HTTP HTML checks do not execute JavaScript or prove authenticated UI rendering. Use the separate Playwright journeys.',
  ];
  if (plan.target.kind === 'fixture')
    confidenceLimits.push(
      'FIXTURE ONLY: this server does not execute application code, D1, GitHub, SMTP or OAuth. No application capacity can be inferred.'
    );
  if (plan.diagnostic)
    confidenceLimits.push(
      'Diagnostic scenario: expected rejection/fault behavior is excluded from capacity claims.'
    );
  if (state.engine === 'playwright')
    confidenceLimits.push(
      'Browser probe with network interception: navigation/action measurements are diagnostic and excluded from HTTP capacity.'
    );
  if (state.generator.samples < 3)
    confidenceLimits.push(
      'Too few generator resource samples to assess saturation.'
    );
  const capacityAllowed =
    invalid.length === 0 &&
    thresholds.pass &&
    state.exitCode === 0 &&
    plan.target.kind !== 'fixture' &&
    !plan.diagnostic &&
    state.engine === 'k6' &&
    state.generator.samples >= 3 &&
    duration >= plan.seconds;
  const eligible = capacityAllowed
    ? phases.filter(
        (p) =>
          p.steady &&
          p.seconds >= plan.settings.sustainedSeconds &&
          p.metrics.latency.count >= 100 &&
          p.thresholds.pass &&
          (p.metrics.droppedRate ?? 1) <= plan.settings.maxDroppedRate
      )
    : [];
  const capacity = eligible.sort(
    (a, b) => b.metrics.completedRps - a.metrics.completedRps
  )[0];
  const observations: string[] = [];
  if (metrics.classes.http_5xx)
    observations.push(
      'Server failures occurred; correlate their time windows with Worker invocation and dependency logs.'
    );
  if (metrics.classes.rate_limit_expected || metrics.classes.http_4xx)
    observations.push(
      'Rejections occurred; inspect authentication quotas and endpoint classification before attributing them to server capacity.'
    );
  if (metrics.classes.timeout || metrics.classes.connection)
    observations.push(
      'Transport failures occurred; inspect both generator networking and upstream timeout telemetry.'
    );
  if (
    metrics.latency.p95 !== null &&
    metrics.latency.p95 >= plan.settings.slo.p95Ms
  )
    observations.push(
      'Latency SLO exceeded; compare TTFB with connection/TLS timing and provider CPU/query duration before naming a bottleneck.'
    );
  const baseline = phases.find((p) => p.name === 'baseline');
  const recovery = phases.find((p) => p.name === 'recovery');
  const recoveryAnalysis =
    baseline && recovery
      ? {
          baselineP95Ms: baseline.metrics.latency.p95,
          recoveryP95Ms: recovery.metrics.latency.p95,
          recoveryMeetsSlo:
            recovery.metrics.latency.count > 0
              ? recovery.thresholds.pass
              : null,
          recoveryCompletedRps: recovery.metrics.completedRps,
          note: 'Phase comparison only; a passing recovery window does not establish exact time to recovery.',
        }
      : null;
  return {
    schemaVersion: 1 as const,
    plan,
    state,
    durationSeconds: duration,
    verdict: (invalid.length
      ? 'INVALID'
      : thresholds.pass && state.exitCode === 0
        ? 'PASS'
        : 'FAIL') as 'PASS' | 'FAIL' | 'INVALID',
    invalidReasons: invalid,
    thresholds,
    metrics,
    buckets,
    phases,
    timing: Object.fromEntries(
      [...collector.timings].map(([key, value]) => [key, value.summary()])
    ),
    infrastructure,
    providerTelemetry: null as ProviderTelemetry | null,
    estimatedRequestCost:
      plan.settings.requestCostPerThousand === undefined
        ? null
        : ((metrics.attempted +
            state.preparationRequests +
            state.cleanupRequests) /
            1000) *
          plan.settings.requestCostPerThousand,
    observedCapacity: capacity
      ? {
          completedRps: capacity.metrics.completedRps,
          activeVus: capacity.metrics.maxVus,
          sustainedSeconds: capacity.seconds,
          phase: capacity.name,
          scope:
            'Maximum qualifying sustained throughput observed in this run; not a proven system maximum.',
        }
      : null,
    recovery: recoveryAnalysis,
    observations,
    limitations: confidenceLimits,
    recommendations: [
      'Repeat matched open and closed workloads against an authorized isolated deployment, then bracket the first SLO failure with smaller steps.',
      'Collect provider telemetry for the same UTC windows and deployment revision; do not infer database or third-party bottlenecks from client latency alone.',
      'Repeat qualifying plateaus and a soak test with independent sessions and a second calibrated generator before setting operational capacity.',
    ],
  };
}

export type Report = ReturnType<typeof createReport>;
const escape = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!
  );
const number = (value: number | null) =>
  value === null ? 'unavailable' : value.toFixed(2);

function chart(title: string, values: (number | null)[], label: string) {
  const known = values.filter((v): v is number => v !== null);
  if (!known.length)
    return `<section><h3>${escape(title)}</h3><p>Unavailable</p></section>`;
  const max = Math.max(...known, 1);
  const points = values.map((value, i) =>
    value === null
      ? null
      : {
          x: 55 + (i * 600) / Math.max(1, values.length - 1),
          y: 160 - (value / max) * 125,
          value,
        }
  );
  // Mark single-window smoke runs and break the line at missing measurements.
  const path = points
    .map((point, i) =>
      point
        ? `${i === 0 || !points[i - 1] ? 'M' : 'L'}${point.x} ${point.y}`
        : ''
    )
    .join(' ');
  const markers = points
    .map((point, i) =>
      point
        ? `<circle cx="${point.x}" cy="${point.y}" r="4" fill="#167d9a"><title>Window ${i + 1}: ${number(point.value)}</title></circle>`
        : ''
    )
    .join('');
  return `<section><h3>${escape(title)}</h3><p>Observed range: ${number(Math.min(...known))} – ${number(Math.max(...known))}</p><svg viewBox="0 0 700 195" role="img" aria-label="${escape(label)}"><text x="5" y="23">${max.toFixed(1)}</text><text x="15" y="166">0</text><path d="M55 30V160H680" fill="none" stroke="#899"/><path d="${path}" fill="none" stroke="#167d9a" stroke-width="2"/>${markers}</svg><p>${escape(label)}; ${known.length} measured window(s).</p></section>`;
}

export async function writeReport(directory: string, report: Report) {
  const m = report.metrics;
  const lines = [
    `# Performance report: ${report.verdict}`,
    '',
    `Run: ${report.plan.runId}. Environment: ${report.plan.environment} (${report.plan.target.kind}). Engine: ${report.state.engine}.`,
    `Deployment: ${report.plan.deploymentRevision}. Source: ${report.plan.sourceRevision}.`,
    `Started: ${report.state.startedAt}. Measurement duration: ${number(report.durationSeconds)} seconds.`,
    '',
    `Workload: ${report.plan.profile}, ${report.plan.settings.model}, ${report.plan.settings.journey}; peak target ${report.plan.settings.model === 'open' ? `${report.plan.rate} journeys/s` : `${report.plan.vus} VUs`}; RPS safety ceiling ${report.plan.maxRps}.`,
    '',
    '| Metric | Observed |',
    '| --- | --- |',
    `| Attempted / completed / successful RPS | ${number(m.attemptedRps)} / ${number(m.completedRps)} / ${number(m.successfulRps)} |`,
    `| Requests attempted / completed / successful | ${m.attempted} / ${m.completed} / ${m.successful} |`,
    `| Latency p50 / p90 / p95 / p99 (ms) | ${number(m.latency.p50)} / ${number(m.latency.p90)} / ${number(m.latency.p95)} / ${number(m.latency.p99)} |`,
    `| Unexpected failure rate | ${number(m.failureRate === null ? null : m.failureRate * 100)}% |`,
    `| Journey success rate | ${number(m.journeySuccessRate === null ? null : m.journeySuccessRate * 100)}% |`,
    `| Iterations started / journeys completed / dropped | ${m.iterationsStarted} / ${m.journeysCompleted} / ${m.droppedIterations} |`,
    `| Peak active VUs | ${m.maxVus ?? 'unavailable'} |`,
    `| Cleanup | ${report.state.cleanup} |`,
    '',
    `Observed sustainable capacity: ${report.observedCapacity ? `${number(report.observedCapacity.completedRps)} completed RPS over ${report.observedCapacity.sustainedSeconds}s (observed bound only).` : 'not established.'}`,
    '',
    '## Assessment',
    '',
    ...[
      ...report.invalidReasons,
      ...report.thresholds.failures,
      ...report.observations,
    ].map((s) => `- ${s}`),
    '',
    '## Reliability classes',
    '',
    ...Object.entries(m.classes).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Infrastructure telemetry',
    '',
    report.providerTelemetry
      ? `Operator-supplied provider export: ${report.providerTelemetry.source}, ${report.providerTelemetry.windowStart} to ${report.providerTelemetry.windowEnd}. Window totals may include background traffic.`
      : 'Unavailable: import a matching provider export with perf:report --telemetry.',
    '',
    ...Object.entries(report.infrastructure).map(
      ([key, value]) => `- ${key}: ${value === null ? 'unavailable' : value}`
    ),
    '',
    `Estimated marginal request cost: ${report.estimatedRequestCost === null ? 'unavailable' : report.estimatedRequestCost}. This estimate excludes CPU, storage, database operations and egress.`,
    '',
    '## Limitations',
    '',
    ...report.limitations.map((s) => `- ${s}`),
    '',
    '## Next measurements',
    '',
    ...report.recommendations.map((s) => `- ${s}`),
    '',
  ];
  const markdown = lines.join('\n');
  const columns = [
    'second',
    'seconds',
    'attemptedRps',
    'completedRps',
    'successfulRps',
    'p95Ms',
    'p99Ms',
    'failureRate',
    'maxVus',
    'droppedIterations',
  ];
  const csv =
    [
      columns.join(','),
      ...report.buckets.map((b) =>
        [
          b.second,
          b.seconds,
          b.attemptedRps,
          b.completedRps,
          b.successfulRps,
          b.latency.p95,
          b.latency.p99,
          b.failureRate,
          b.maxVus,
          b.droppedIterations,
        ]
          .map((v) => v ?? '')
          .join(',')
      ),
    ].join('\n') + '\n';
  const charts = [
    chart(
      'Completed RPS over time',
      report.buckets.map((b) => b.completedRps),
      '10-second windows in chronological order'
    ),
    chart(
      'P95 latency over time (ms)',
      report.buckets.map((b) => b.latency.p95),
      '10-second windows'
    ),
    chart(
      'P99 latency over time (ms)',
      report.buckets.map((b) => b.latency.p99),
      '10-second windows'
    ),
    chart(
      'Unexpected failure rate',
      report.buckets.map((b) => b.failureRate),
      'Fraction of finished requests'
    ),
    chart(
      'Active VUs over time',
      report.buckets.map((b) => b.maxVus),
      'Maximum sampled VUs per window'
    ),
  ].join('');
  const phaseTable = report.phases
    .map(
      (p) =>
        `<tr><td>${escape(p.name)}</td><td>${p.seconds}</td><td>${number(p.metrics.completedRps)}</td><td>${number(p.metrics.latency.p95)}</td><td>${number(p.metrics.latency.p99)}</td><td>${p.thresholds.pass ? 'PASS' : 'FAIL'}</td></tr>`
    )
    .join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Performance ${escape(report.verdict)}</title><style>body{font:16px system-ui;margin:2rem auto;padding:0 1rem;max-width:1100px;color:#172b36;background:#f6f8fa}h1{font-size:2rem}section{background:white;padding:1rem;border:1px solid #dde;border-radius:8px}article{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:1rem}svg{width:100%;font:22px system-ui}pre{white-space:pre-wrap;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;background:white}td,th{padding:.5rem;text-align:left;border:1px solid #dde}</style></head><body><h1>${escape(report.verdict)} · ${escape(report.plan.environment)}</h1><p>${escape(report.plan.target.kind)} · ${escape(report.plan.settings.model)} · ${escape(report.plan.profile)} · ${escape(report.plan.createdAt)}</p><article>${charts}</article><h2>Latency versus achieved throughput and SLOs</h2><p>Configured p95 &lt; ${report.plan.settings.slo.p95Ms} ms; p99 &lt; ${report.plan.settings.slo.p99Ms} ms. Ramps are excluded from capacity.</p><table><tr><th>Phase</th><th>Seconds</th><th>Completed RPS</th><th>P95 ms</th><th>P99 ms</th><th>SLO</th></tr>${phaseTable}</table><h2>Full assessment</h2><pre>${escape(markdown)}</pre><h2>Recovery</h2><pre>${escape(JSON.stringify(report.recovery, null, 2))}</pre></body></html>`;
  await Promise.all([
    writeFile(
      resolve(directory, 'report.json'),
      JSON.stringify(report, null, 2) + '\n'
    ),
    writeFile(resolve(directory, 'metrics.csv'), csv),
    writeFile(resolve(directory, 'summary.md'), markdown),
    writeFile(resolve(directory, 'report.html'), html),
  ]);
}
