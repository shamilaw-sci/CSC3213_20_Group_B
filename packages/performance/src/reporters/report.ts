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
const number = (value: number | null) =>
  value === null ? 'unavailable' : value.toFixed(2);
const markdownCell = (value: unknown) =>
  String(value ?? 'unavailable')
    .replaceAll('|', '\\|')
    .replace(/\r?\n/g, ' ');

export async function writeReport(directory: string, report: Report) {
  const m = report.metrics;
  const assessment = [
    ...report.invalidReasons,
    ...report.thresholds.failures,
    ...report.observations,
  ];
  const lines = [
    '# Performance Report',
    '',
    `**Verdict:** ${report.verdict}`,
    '',
    '## Run Metadata',
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| Run | ${markdownCell(report.plan.runId)} |`,
    `| Environment | ${markdownCell(report.plan.environment)} (${markdownCell(report.plan.target.kind)}) |`,
    `| Engine | ${markdownCell(report.state.engine)} |`,
    `| Started | ${markdownCell(report.state.startedAt)} |`,
    `| Duration | ${number(report.durationSeconds)} seconds |`,
    `| Profile | ${markdownCell(report.plan.profile)} |`,
    `| Workload | ${markdownCell(report.plan.settings.model)} / ${markdownCell(report.plan.settings.journey)} |`,
    `| Peak target | ${report.plan.settings.model === 'open' ? `${report.plan.rate} journeys/s` : `${report.plan.vus} VUs`} |`,
    `| RPS safety ceiling | ${report.plan.maxRps} |`,
    `| Deployment revision | \`${markdownCell(report.plan.deploymentRevision)}\` |`,
    `| Source revision | \`${markdownCell(report.plan.sourceRevision)}\` |`,
    '',
    '## Summary',
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
    ...(assessment.length
      ? assessment.map((s) => `- ${s}`)
      : ['No validity, threshold, or observation findings were recorded.']),
    '',
    '## Reliability classes',
    '',
    ...Object.entries(m.classes).map(
      ([key, value]) => `- **${markdownCell(key)}:** ${value}`
    ),
    '',
    '## Infrastructure telemetry',
    '',
    report.providerTelemetry
      ? `Operator-supplied provider export: ${report.providerTelemetry.source}, ${report.providerTelemetry.windowStart} to ${report.providerTelemetry.windowEnd}. Window totals may include background traffic.`
      : 'Unavailable: import a matching provider export with perf:report --telemetry.',
    '',
    ...Object.entries(report.infrastructure).map(
      ([key, value]) =>
        `- **${markdownCell(key)}:** ${value === null ? 'unavailable' : markdownCell(value)}`
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
  const markdown = `${lines.join('\n')}\n`;
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
  await Promise.all([
    writeFile(
      resolve(directory, 'report.json'),
      JSON.stringify(report, null, 2) + '\n'
    ),
    writeFile(resolve(directory, 'metrics.csv'), csv),
    writeFile(resolve(directory, 'summary.md'), markdown),
    writeFile(resolve(directory, 'report.md'), markdown),
  ]);
}
