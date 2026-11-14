import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

import { z } from 'zod';

import type { Plan, Slo } from '@/config/schema';

export class Histogram {
  count = 0;
  sum = 0;
  min = Infinity;
  max = 0;
  bins = new Map<number, number>();
  add(value: number) {
    if (!Number.isFinite(value) || value < 0)
      throw new Error('Invalid metric sample.');
    this.count++;
    this.sum += value;
    this.min = Math.min(this.min, value);
    this.max = Math.max(this.max, value);
    const bin = value <= 0 ? 0 : Math.ceil(Math.log1p(value) / Math.log(1.01));
    this.bins.set(bin, (this.bins.get(bin) ?? 0) + 1);
  }
  percentile(q: number) {
    if (!this.count) return null;
    let cumulative = 0;
    for (const [bin, count] of [...this.bins.entries()].sort(
      ([a], [b]) => a - b
    )) {
      cumulative += count;
      if (cumulative >= Math.ceil(this.count * q))
        return Math.min(this.max, Math.expm1(bin * Math.log(1.01)));
    }
    return this.max;
  }
  summary() {
    return {
      count: this.count,
      avg: this.count ? this.sum / this.count : null,
      min: this.count ? this.min : null,
      max: this.count ? this.max : null,
      p50: this.percentile(0.5),
      p90: this.percentile(0.9),
      p95: this.percentile(0.95),
      p99: this.percentile(0.99),
    };
  }
}

export class WindowMetrics {
  latency = new Histogram();
  attempted = 0;
  completed = 0;
  successful = 0;
  failures = 0;
  iterationsStarted = 0;
  journeysCompleted = 0;
  journeysSuccessful = 0;
  dropped = 0;
  maxVus: number | null = null;
  integrity = 0;
  guardrail = 0;
  classes: Record<string, number> = {};
  endpoints = new Map<
    string,
    { latency: Histogram; failed: number; count: number }
  >();
  add(metric: string, value: number, tags: Record<string, string>) {
    if (metric === 'perf_attempted') this.attempted += value;
    if (metric === 'perf_completed') this.completed += value;
    if (metric === 'perf_successful') this.successful += value;
    if (metric === 'perf_failure') this.failures += value;
    if (metric === 'perf_iterations_started') this.iterationsStarted += value;
    if (metric === 'perf_journeys_completed') this.journeysCompleted += value;
    if (metric === 'perf_journey_success') this.journeysSuccessful += value;
    if (metric === 'dropped_iterations') this.dropped += value;
    if (metric === 'vus') this.maxVus = Math.max(this.maxVus ?? 0, value);
    if (metric === 'perf_integrity') this.integrity += value;
    if (metric === 'perf_guardrail') this.guardrail += value;
    if (metric === 'perf_latency') {
      this.latency.add(value);
      const classification = [
        'ok',
        'timeout',
        'connection',
        'rate_limit_expected',
        'http_4xx',
        'http_5xx',
        'unexpected_status',
        'assertion',
      ].includes(tags.classification)
        ? tags.classification
        : 'unknown';
      this.classes[classification] = (this.classes[classification] ?? 0) + 1;
      const endpoint = /^[a-z_]{1,60}$/.test(tags.endpoint ?? '')
        ? tags.endpoint
        : 'unknown';
      const entry = this.endpoints.get(endpoint) ?? {
        latency: new Histogram(),
        count: 0,
        failed: 0,
      };
      entry.latency.add(value);
      entry.count++;
      if (!['ok', 'rate_limit_expected'].includes(classification))
        entry.failed++;
      this.endpoints.set(endpoint, entry);
    }
  }
  summary(seconds: number) {
    return {
      seconds,
      attempted: this.attempted,
      completed: this.completed,
      successful: this.successful,
      attemptedRps: this.attempted / seconds,
      completedRps: this.completed / seconds,
      successfulRps: this.successful / seconds,
      failures: this.failures,
      failureRate: this.latency.count
        ? this.failures / this.latency.count
        : null,
      iterationsStarted: this.iterationsStarted,
      journeysCompleted: this.journeysCompleted,
      failedJourneys: this.journeysCompleted - this.journeysSuccessful,
      journeySuccessRate: this.journeysCompleted
        ? this.journeysSuccessful / this.journeysCompleted
        : null,
      droppedIterations: this.dropped,
      droppedRate:
        this.iterationsStarted + this.dropped
          ? this.dropped / (this.iterationsStarted + this.dropped)
          : null,
      maxVus: this.maxVus,
      integrityFailures: this.integrity,
      guardrailEvents: this.guardrail,
      latency: this.latency.summary(),
      classes: this.classes,
      endpoints: Object.fromEntries(
        [...this.endpoints].map(([key, e]) => [
          key,
          { latency: e.latency.summary(), failureRate: e.failed / e.count },
        ])
      ),
    };
  }
}

export type Metrics = ReturnType<WindowMetrics['summary']>;
export function evaluate(
  metrics: Metrics,
  slo: Slo,
  endpointSlo: Record<string, Slo>
) {
  const failures: string[] = [];
  if (metrics.latency.p95 === null || metrics.latency.p95 >= slo.p95Ms)
    failures.push('P95 latency');
  if (metrics.latency.p99 === null || metrics.latency.p99 >= slo.p99Ms)
    failures.push('P99 latency');
  if (
    metrics.failureRate === null ||
    (slo.failureRate === 0
      ? metrics.failureRate > 0
      : metrics.failureRate >= slo.failureRate)
  )
    failures.push('Unexpected request failure rate');
  if (
    metrics.journeySuccessRate === null ||
    (slo.journeySuccessRate === 1
      ? metrics.journeySuccessRate < 1
      : metrics.journeySuccessRate <= slo.journeySuccessRate)
  )
    failures.push('Journey success rate');
  if (metrics.integrityFailures > 0) failures.push('Synthetic write integrity');
  for (const [name, threshold] of Object.entries(endpointSlo)) {
    const endpoint = metrics.endpoints[name];
    if (!endpoint) {
      failures.push(`Missing endpoint: ${name}`);
      continue;
    }
    if (
      endpoint.latency.p95 === null ||
      endpoint.latency.p95 >= threshold.p95Ms ||
      endpoint.latency.p99 === null ||
      endpoint.latency.p99 >= threshold.p99Ms ||
      (threshold.failureRate === 0
        ? endpoint.failureRate > 0
        : endpoint.failureRate >= threshold.failureRate)
    )
      failures.push(`Endpoint SLO: ${name}`);
  }
  return { pass: failures.length === 0, failures };
}

const pointSchema = z.object({
  type: z.literal('Point'),
  metric: z.string().max(100),
  data: z.object({
    time: z.iso.datetime({ offset: true }),
    value: z.number().nonnegative(),
    tags: z.record(z.string(), z.string()).nullish(),
  }),
});
const timingNames = [
  'http_req_waiting',
  'http_req_connecting',
  'http_req_tls_handshaking',
  'http_req_blocked',
  'http_req_sending',
  'http_req_receiving',
] as const;
export class MetricsCollector {
  total = new WindowMetrics();
  buckets = new Map<number, WindowMetrics>();
  phases = new Map<string, WindowMetrics>();
  timings = new Map<string, Histogram>();
  epoch: number | null = null;
  lastTime = 0;
  runComplete = false;
  malformed = 0;
  points = 0;
  constructor(readonly plan: Plan) {}
  consume(raw: unknown) {
    if (
      !raw ||
      typeof raw !== 'object' ||
      !('type' in raw) ||
      raw.type !== 'Point'
    )
      return;
    const parsed = pointSchema.safeParse(raw);
    if (!parsed.success) {
      this.malformed++;
      return;
    }
    const { metric, data } = parsed.data;
    this.points++;
    if (metric === 'perf_epoch') {
      this.epoch =
        this.epoch === null ? data.value : Math.min(this.epoch, data.value);
      return;
    }
    if (
      !metric.startsWith('perf_') &&
      !['vus', 'dropped_iterations', ...timingNames].includes(metric)
    )
      return;
    const time = Date.parse(data.time);
    if (metric === 'perf_run_complete') this.runComplete = true;
    const tags = data.tags ?? {};
    this.total.add(metric, data.value, tags);
    if ((timingNames as readonly string[]).includes(metric)) {
      const histogram = this.timings.get(metric) ?? new Histogram();
      histogram.add(data.value);
      this.timings.set(metric, histogram);
    }
    if (this.epoch === null) return;
    const elapsed = Math.max(0, (time - this.epoch) / 1000);
    if (elapsed > this.plan.seconds + 120) {
      this.malformed++;
      return;
    }
    this.lastTime = Math.max(this.lastTime, elapsed);
    const bucket = Math.floor(elapsed / 10) * 10;
    const window = this.buckets.get(bucket) ?? new WindowMetrics();
    window.add(metric, data.value, tags);
    this.buckets.set(bucket, window);
    let end = 0;
    const phase = this.plan.phases.find((p) => {
      end += p.seconds;
      return elapsed < end;
    });
    if (phase) {
      const metrics = this.phases.get(phase.name) ?? new WindowMetrics();
      metrics.add(metric, data.value, tags);
      this.phases.set(phase.name, metrics);
    }
  }
}

export async function collectFile(file: string, plan: Plan) {
  const collector = new MetricsCollector(plan);
  const reader = createInterface({
    input: createReadStream(file),
    crlfDelay: Infinity,
  });
  for await (const line of reader) {
    if (!line) continue;
    try {
      collector.consume(JSON.parse(line) as unknown);
    } catch {
      collector.malformed++;
    }
  }
  return collector;
}
