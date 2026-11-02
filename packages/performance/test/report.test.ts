import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { plan } from 'test/support';

import { compareReports } from '@/compare';
import { Histogram, MetricsCollector } from '@/reporters/metrics';
import { createReport, writeReport } from '@/reporters/report';
import { initialState, regenerateReport } from '@/runner';

function measured(settings: Record<string, unknown> = {}, perSecond = 1) {
  const p = plan({ vus: 1, seconds: 120, journey: 'safe', ...settings });
  const c = new MetricsCollector(p);
  const start = Date.now();
  const points: unknown[] = [];
  const point = (
    metric: string,
    value: number,
    second: number,
    classification = 'ok'
  ) => {
    const raw = {
      type: 'Point',
      metric,
      data: {
        time: new Date(start + second * 1000).toISOString(),
        value,
        tags: { endpoint: 'web_home', classification },
      },
    };
    points.push(raw);
    c.consume(raw);
  };
  point('perf_epoch', start, 0);
  for (let second = 0; second <= 120; second++) {
    for (let request = 0; request < perSecond; request++) {
      for (const metric of [
        'perf_attempted',
        'perf_completed',
        'perf_successful',
        'perf_iterations_started',
        'perf_journeys_completed',
        'perf_journey_success',
      ])
        point(metric, 1, second);
      point('perf_latency', 100, second);
      point('perf_failure', 0, second);
    }
    point('vus', 1, second);
  }
  point('perf_run_complete', start + 120000, 120);
  const state = initialState();
  state.exitCode = 0;
  state.generator.samples = 120;
  state.startedAt = new Date(start).toISOString();
  state.finishedAt = new Date(start + 120000).toISOString();
  return { p, c, state, point, points };
}

test('histograms bound percentile error without storing every request', () => {
  const histogram = new Histogram();
  for (let i = 1; i <= 100000; i++) histogram.add(i % 1000);
  expect(histogram.bins.size).toBeLessThan(1000);
  expect(histogram.percentile(0.95)).toBeGreaterThanOrEqual(949);
  expect(histogram.percentile(0.95)).toBeLessThan(960);
  expect(new Histogram().summary().p99).toBeNull();
});
test('reports honest rates, missing infrastructure and no fixture capacity', () => {
  const { p, c, state } = measured();
  const report = createReport(p, c, state);
  expect(report.verdict).toBe('PASS');
  expect(report.metrics.completedRps).toBeCloseTo(121 / 120);
  expect(report.infrastructure.d1QueryMs).toBeNull();
  expect(report.observedCapacity).toBeNull();
});
test('capacity uses sustained completed throughput and all thresholds', () => {
  const { p, c, state } = measured({}, 2);
  p.target.kind = 'isolated';
  expect(createReport(p, c, state).observedCapacity?.completedRps).toBe(2);
  c.total.failures = 20;
  const failing = createReport(p, c, state);
  expect(failing.verdict).toBe('FAIL');
  expect(failing.observedCapacity).toBeNull();
});

test('zero failures and complete journey success are attainable strict boundary SLOs', () => {
  const { p, c, state, point } = measured({
    slo: { failureRate: 0, journeySuccessRate: 1 },
    endpointSlo: { web_home: { failureRate: 0 } },
  });
  expect(createReport(p, c, state).verdict).toBe('PASS');
  point('perf_journeys_completed', 1, 120);
  expect(createReport(p, c, state).thresholds.failures).toContain(
    'Journey success rate'
  );
  point('perf_attempted', 1, 120);
  point('perf_completed', 1, 120);
  point('perf_latency', 100, 120, 'http_5xx');
  point('perf_failure', 1, 120);
  const report = createReport(p, c, state);
  expect(report.thresholds.failures).toContain(
    'Unexpected request failure rate'
  );
  expect(report.thresholds.failures).toContain('Endpoint SLO: web_home');
});

test('regeneration validates provider evidence against run, revision, complete window and schema', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'scs-performance-'));
  try {
    const { p, c, state, points } = measured();
    await writeFile(join(directory, 'plan.json'), JSON.stringify(p));
    await writeFile(join(directory, 'state.json'), JSON.stringify(state));
    await writeFile(
      join(directory, 'metrics.ndjson'),
      points.map((p) => JSON.stringify(p)).join('\n') + '\n'
    );
    const telemetryFile = join(directory, 'input.json');
    const telemetry = {
      ...createReport(p, c, state).infrastructure,
      runId: p.runId,
      deploymentRevision: p.deploymentRevision,
      source: 'provider-export-1',
      windowStart: state.startedAt,
      windowEnd: state.finishedAt,
      workerRequests: 121,
    };
    await writeFile(telemetryFile, JSON.stringify(telemetry));
    const imported = await regenerateReport(directory, telemetryFile);
    expect(imported.infrastructure.workerRequests).toBe(121);
    expect(imported.infrastructure.d1QueryMs).toBeNull();
    expect((await regenerateReport(directory)).providerTelemetry).toEqual(
      telemetry
    );
    for (const change of [
      { runId: 'perf-20260101000000000-aaaaaaaa' },
      { deploymentRevision: 'b'.repeat(40) },
      { windowStart: state.finishedAt },
      { windowEnd: state.startedAt },
      { workerRequests: -1 },
      { cookie: 'unexpected-field' },
    ]) {
      await writeFile(
        telemetryFile,
        JSON.stringify({ ...telemetry, ...change })
      );
      await expect(
        regenerateReport(directory, telemetryFile)
      ).rejects.toThrow();
    }
  } finally {
    await rm(directory, { recursive: true });
  }
});
test('drops, saturation, empty streams, cleanup and abort invalidate capacity', () => {
  for (const reason of [
    'drops',
    'cpu',
    'cleanup',
    'cancel',
    'empty',
    'budget',
    'completion',
  ]) {
    const { p, c, state, point } = measured();
    if (reason === 'drops') point('dropped_iterations', 1, 60);
    if (reason === 'cpu') state.generator.saturated = true;
    if (reason === 'cleanup') state.cleanup = 'failed';
    if (reason === 'cancel') state.reason = 'Cancelled by operator';
    if (reason === 'budget') point('perf_guardrail', 1, 60);
    if (reason === 'completion') c.runComplete = false;
    const result = createReport(
      p,
      reason === 'empty' ? new MetricsCollector(p) : c,
      state
    );
    expect(result.verdict).toBe('INVALID');
    expect(result.observedCapacity).toBeNull();
  }
});
test('expected throttling does not count as unexpected failure or successful journey', () => {
  const { p, c, state, point } = measured();
  point('perf_latency', 50, 60, 'rate_limit_expected');
  point('perf_journeys_completed', 1, 60);
  const r = createReport(p, c, state);
  expect(r.metrics.failureRate).toBe(0);
  expect(r.metrics.classes.rate_limit_expected).toBe(1);
  expect(r.metrics.journeySuccessRate).toBeLessThan(1);
});
test('reports render JSON, CSV and formatted Markdown artifacts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'scs-performance-'));
  try {
    const { p, c, state } = measured();
    state.reason = '<script>alert("secret")</script>';
    const r = createReport(p, c, state);
    await writeReport(directory, r);
    expect(
      JSON.parse(await readFile(join(directory, 'report.json'), 'utf8')).verdict
    ).toBe('INVALID');
    expect(await readFile(join(directory, 'metrics.csv'), 'utf8')).toContain(
      'completedRps'
    );
    const markdown = await readFile(join(directory, 'report.md'), 'utf8');
    expect(markdown).toContain('# Performance Report');
    expect(markdown).toContain('## Run Metadata');
    expect(markdown).toContain('| Metric | Observed |');
    expect(markdown).toContain('## Assessment');
    expect(markdown).toContain('not established');
    expect(markdown.endsWith('\n')).toBe(true);
    expect(await readFile(join(directory, 'summary.md'), 'utf8')).toBe(
      markdown
    );
  } finally {
    await rm(directory, { recursive: true });
  }
});
test('formatted Markdown explains an empty assessment', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'scs-performance-'));
  try {
    const { p, c, state } = measured();
    await writeReport(directory, createReport(p, c, state));
    expect(await readFile(join(directory, 'report.md'), 'utf8')).toContain(
      'No validity, threshold, or observation findings were recorded.'
    );
  } finally {
    await rm(directory, { recursive: true });
  }
});
test('baseline comparisons reject incompatible runs and detect regressions', () => {
  const { p, c, state } = measured();
  const baseline = createReport(p, c, state);
  const current = structuredClone(baseline);
  current.metrics.latency.p95 = 1000;
  expect(compareReports(baseline, current).pass).toBe(false);
  current.plan.settings.model = 'open';
  expect(() => compareReports(baseline, current)).toThrow('matched');
});
