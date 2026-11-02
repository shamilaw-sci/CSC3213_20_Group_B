'use client';

import { type ReactNode, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { ReportData as Report } from '@/lib/report-types';

type ChartView = 'throughput' | 'latency' | 'reliability' | 'load';

const decimal = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});
const integer = new Intl.NumberFormat('en-US');
const dateTime = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'medium',
  timeZone: 'UTC',
});
const formatNumber = (value: number | null) =>
  value === null ? 'Unavailable' : decimal.format(value);
const formatPercent = (value: number | null) =>
  value === null ? 'Unavailable' : `${decimal.format(value * 100)}%`;
const label = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

function Verdict({ value }: { value: string }) {
  const color =
    value === 'PASS'
      ? 'bg-success'
      : value === 'FAIL'
        ? 'bg-danger'
        : 'bg-warning';
  return (
    <span
      className="inline-flex items-center gap-2 font-mono text-sm font-semibold"
    >
      <span className={`size-2 ${color}`} aria-hidden="true" />
      {value}
    </span>
  );
}

function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="border-line scroll-mt-5 border-t py-8">
      <div className="mb-5 grid gap-1 md:grid-cols-[13rem_1fr] md:gap-6">
        <h2 className="text-lg font-semibold">{title}</h2>
        {note ? <p className="text-subtle max-w-3xl text-sm">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="border-line overflow-x-auto border">
      <table className="w-full min-w-176 border-collapse text-left text-sm">
        <thead className="bg-muted text-subtle text-xs">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                scope="col"
                className="border-line border-b px-3 py-2 font-semibold"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-line border-b last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="px-3 py-2 align-top tabular-nums"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DefinitionRows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="border-line border text-sm">
      {rows.map(([term, value]) => (
        <div
          key={term}
          className="border-line grid grid-cols-[minmax(9rem,1fr)_2fr] border-b
            last:border-b-0"
        >
          <dt className="bg-muted text-subtle px-3 py-2">{term}</dt>
          <dd className="px-3 py-2 wrap-anywhere tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TimeSeries({ report }: { report: Report }) {
  const [view, setView] = useState<ChartView>('throughput');
  const data = useMemo(
    () =>
      report.buckets.map((bucket) => ({
        second: bucket.second,
        attemptedRps: bucket.attemptedRps,
        completedRps: bucket.completedRps,
        successfulRps: bucket.successfulRps,
        p95: bucket.latency.p95,
        p99: bucket.latency.p99,
        failurePercent:
          bucket.failureRate === null ? null : bucket.failureRate * 100,
        activeVus: bucket.maxVus,
        dropped: bucket.droppedIterations,
      })),
    [report.buckets]
  );
  const views: [ChartView, string][] = [
    ['throughput', 'Throughput'],
    ['latency', 'Latency'],
    ['reliability', 'Reliability'],
    ['load', 'Active Load'],
  ];
  const selectView = (next: ChartView) => {
    setView(next);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('chart', next);
      window.history.replaceState({}, '', url);
    }
  };
  const common = {
    data,
    margin: { top: 10, right: 24, bottom: 4, left: 0 },
  };
  const axis = { fill: '#4b5563', fontSize: 12 };
  const tooltip = { border: '1px solid #d1d5db', borderRadius: 0 };

  return (
    <div className="border-line bg-panel border">
      <div
        className="border-line flex overflow-x-auto border-b print:hidden"
        role="group"
        aria-label="Chart metric"
      >
        {views.map(([key, name]) => (
          <button
            key={key}
            type="button"
            aria-pressed={view === key}
            onClick={() => selectView(key)}
            className={`border-line touch-manipulation border-r px-4 py-2
            text-sm font-medium ${
              view === key
                ? 'bg-ink text-panel'
                : 'bg-panel text-subtle hover:bg-muted hover:text-ink'
            }`}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="h-80 w-full p-3" aria-label={`${label(view)} over time`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart {...common}>
            <CartesianGrid stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="second" unit="s" tick={axis} />
            <YAxis
              width={68}
              tick={axis}
              unit={
                view === 'latency'
                  ? ' ms'
                  : view === 'reliability'
                    ? '%'
                    : undefined
              }
            />
            <Tooltip
              contentStyle={tooltip}
              labelFormatter={(value) => `${value}s`}
            />
            <Legend />
            {view === 'throughput' ? (
              <>
                <Line
                  dataKey="attemptedRps"
                  name="Attempted RPS"
                  stroke="#6b7280"
                  dot={false}
                  strokeDasharray="5 4"
                />
                <Line
                  dataKey="completedRps"
                  name="Completed RPS"
                  stroke="#0f766e"
                  dot={false}
                  strokeWidth={2}
                />
                <Line
                  dataKey="successfulRps"
                  name="Successful RPS"
                  stroke="#15803d"
                  dot={false}
                />
              </>
            ) : null}
            {view === 'latency' ? (
              <>
                <ReferenceLine
                  y={report.plan.settings.slo.p95Ms}
                  stroke="#b45309"
                  strokeDasharray="5 4"
                  label="P95 SLO"
                />
                <ReferenceLine
                  y={report.plan.settings.slo.p99Ms}
                  stroke="#b91c1c"
                  strokeDasharray="5 4"
                  label="P99 SLO"
                />
                <Line
                  dataKey="p95"
                  name="P95"
                  stroke="#0f766e"
                  dot={false}
                  strokeWidth={2}
                  connectNulls={false}
                />
                <Line
                  dataKey="p99"
                  name="P99"
                  stroke="#4338ca"
                  dot={false}
                  strokeWidth={2}
                  connectNulls={false}
                />
              </>
            ) : null}
            {view === 'reliability' ? (
              <>
                <ReferenceLine
                  y={report.plan.settings.slo.failureRate * 100}
                  stroke="#b91c1c"
                  strokeDasharray="5 4"
                  label="Failure SLO"
                />
                <Line
                  dataKey="failurePercent"
                  name="Unexpected Failure %"
                  stroke="#b91c1c"
                  dot={false}
                  strokeWidth={2}
                  connectNulls={false}
                />
              </>
            ) : null}
            {view === 'load' ? (
              <>
                <Line
                  dataKey="activeVus"
                  name="Active VUs"
                  stroke="#0f766e"
                  dot={false}
                  strokeWidth={2}
                />
                <Line
                  dataKey="dropped"
                  name="Dropped Iterations"
                  stroke="#b91c1c"
                  dot={false}
                />
              </>
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="border-line text-subtle border-t px-3 py-2 text-xs">
        Ten-second measurement windows. Values are observed, not interpolated.
      </p>
    </div>
  );
}

export function ReportApp({ report }: { report: Report }) {
  const assessment = [
    ...report.invalidReasons,
    ...report.thresholds.failures,
    ...report.observations,
  ];
  const endpoints = Object.entries(report.metrics.endpoints).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const timing = Object.entries(report.timing).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return (
    <>
      <a
        href="#main"
        className="focus:ring-brand focus:bg-panel sr-only focus:not-sr-only
          focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-3 focus:py-2
          focus:ring-2"
      >
        Skip to report
      </a>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <header className="border-ink border-b-2 pb-5">
          <div
            className="border-line flex flex-wrap items-baseline justify-between
              gap-3 border-b pb-3 text-sm"
          >
            <p className="font-mono font-semibold">SCS PDN / PERFORMANCE</p>
            <Verdict value={report.verdict} />
          </div>
          <div className="grid gap-5 pt-5 lg:grid-cols-[1fr_24rem]">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Performance Report
              </h1>
              <p className="text-subtle mt-2">
                {report.plan.environment} · {report.plan.profile} ·{' '}
                {report.plan.settings.model} · {report.plan.settings.journey}
              </p>
            </div>
            <DefinitionRows
              rows={[
                ['Run', <code key="run">{report.plan.runId}</code>],
                ['Started', dateTime.format(new Date(report.state.startedAt))],
                ['Duration', `${formatNumber(report.durationSeconds)} seconds`],
                [
                  'Revision',
                  <code key="revision">
                    {report.plan.deploymentRevision.slice(0, 12)}
                  </code>,
                ],
              ]}
            />
          </div>
        </header>

        <nav
          className="border-line flex flex-wrap gap-x-5 gap-y-2 border-b py-3
            text-sm print:hidden"
          aria-label="Report sections"
        >
          {[
            ['summary', 'Summary'],
            ['time-series', 'Time Series'],
            ['phases', 'Phases'],
            ['assessment', 'Assessment'],
            ['infrastructure', 'Infrastructure'],
            ['notes', 'Notes'],
          ].map(([id, name]) => (
            <a
              key={id}
              href={`#${id}`}
              className="text-subtle hover:text-ink underline-offset-4
                hover:underline"
            >
              {name}
            </a>
          ))}
        </nav>

        <main id="main">
          <Section
            id="summary"
            title="Summary"
            note="Run-level measurements and their configured thresholds."
          >
            <DataTable
              headers={['Metric', 'Observed', 'Target / Context']}
              rows={[
                [
                  'Completed throughput',
                  `${formatNumber(report.metrics.completedRps)} RPS`,
                  `${integer.format(report.metrics.completed)} of ${integer.format(report.metrics.attempted)} requests completed`,
                ],
                [
                  'P95 latency',
                  `${formatNumber(report.metrics.latency.p95)} ms`,
                  `< ${integer.format(report.plan.settings.slo.p95Ms)} ms`,
                ],
                [
                  'P99 latency',
                  `${formatNumber(report.metrics.latency.p99)} ms`,
                  `< ${integer.format(report.plan.settings.slo.p99Ms)} ms`,
                ],
                [
                  'Unexpected failures',
                  formatPercent(report.metrics.failureRate),
                  `< ${formatPercent(report.plan.settings.slo.failureRate)}`,
                ],
                [
                  'Journey success',
                  formatPercent(report.metrics.journeySuccessRate),
                  `${integer.format(report.metrics.journeysCompleted)} completed journeys`,
                ],
                [
                  'Peak active VUs',
                  report.metrics.maxVus === null
                    ? 'Unavailable'
                    : integer.format(report.metrics.maxVus),
                  `RPS safety ceiling ${integer.format(report.plan.maxRps)}`,
                ],
              ]}
            />
            <div
              className="border-warning bg-muted mt-4 border-l-4 px-4 py-3
                text-sm"
            >
              <strong>Observed sustainable capacity: </strong>
              {report.observedCapacity
                ? `${formatNumber(report.observedCapacity.completedRps)} completed RPS over ${report.observedCapacity.sustainedSeconds} seconds in ${report.observedCapacity.phase}. This is an observed bound, not a system maximum.`
                : 'Not established. This run did not meet the evidence requirements for a capacity claim.'}
            </div>
          </Section>

          <Section
            id="time-series"
            title="Time Series"
            note="Select one measurement family. SLO reference lines appear only where applicable."
          >
            <TimeSeries report={report} />
          </Section>

          <Section
            id="phases"
            title="Phases"
            note="Ramp windows remain visible but do not qualify as sustained-capacity evidence."
          >
            <DataTable
              headers={[
                'Phase',
                'Duration',
                'Target',
                'Completed RPS',
                'P95',
                'P99',
                'SLO',
              ]}
              rows={report.phases.map((phase) => [
                label(phase.name),
                `${phase.seconds}s`,
                `${phase.target} ${report.plan.settings.model === 'open' ? 'journeys/s' : 'VUs'}`,
                formatNumber(phase.metrics.completedRps),
                `${formatNumber(phase.metrics.latency.p95)} ms`,
                `${formatNumber(phase.metrics.latency.p99)} ms`,
                <Verdict
                  key="verdict"
                  value={phase.thresholds.pass ? 'PASS' : 'FAIL'}
                />,
              ])}
            />
          </Section>

          <Section
            id="assessment"
            title="Assessment"
            note="Findings are derived from validity checks, thresholds, request classes, and endpoint measurements."
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold">Findings</h3>
                {assessment.length ? (
                  <ul className="border-line border text-sm">
                    {assessment.map((item) => (
                      <li
                        key={item}
                        className="border-line border-b px-3 py-2
                          last:border-b-0"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p
                    className="border-line text-subtle border px-3 py-2 text-sm"
                  >
                    No findings were recorded.
                  </p>
                )}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">
                  Reliability Classes
                </h3>
                <DefinitionRows
                  rows={Object.entries(report.metrics.classes).map(
                    ([name, value]) => [label(name), integer.format(value)]
                  )}
                />
              </div>
            </div>

            <h3 className="mt-6 mb-2 text-sm font-semibold">
              Endpoint Measurements
            </h3>
            {endpoints.length ? (
              <DataTable
                headers={[
                  'Endpoint',
                  'Samples',
                  'P50',
                  'P95',
                  'P99',
                  'Failure Rate',
                ]}
                rows={endpoints.map(([name, endpoint]) => [
                  label(name),
                  integer.format(endpoint.latency.count),
                  `${formatNumber(endpoint.latency.p50)} ms`,
                  `${formatNumber(endpoint.latency.p95)} ms`,
                  `${formatNumber(endpoint.latency.p99)} ms`,
                  formatPercent(endpoint.failureRate),
                ])}
              />
            ) : (
              <p className="border-line text-subtle border px-3 py-2 text-sm">
                No endpoint measurements were recorded.
              </p>
            )}

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold">Load Generator</h3>
                <DefinitionRows
                  rows={[
                    [
                      'Peak CPU',
                      formatPercent(report.state.generator.maxCpuRatio),
                    ],
                    [
                      'Minimum free memory',
                      formatPercent(report.state.generator.minFreeMemoryRatio),
                    ],
                    [
                      'Maximum timer lag',
                      report.state.generator.maxTimerLagMs === null
                        ? 'Unavailable'
                        : `${formatNumber(report.state.generator.maxTimerLagMs)} ms`,
                    ],
                    [
                      'Saturation',
                      report.state.generator.saturated
                        ? 'Observed'
                        : 'Not observed',
                    ],
                  ]}
                />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Recovery</h3>
                {report.recovery ? (
                  <DefinitionRows
                    rows={[
                      [
                        'Baseline P95',
                        `${formatNumber(report.recovery.baselineP95Ms)} ms`,
                      ],
                      [
                        'Recovery P95',
                        `${formatNumber(report.recovery.recoveryP95Ms)} ms`,
                      ],
                      [
                        'Recovery completed RPS',
                        formatNumber(report.recovery.recoveryCompletedRps),
                      ],
                      ['Interpretation', report.recovery.note],
                    ]}
                  />
                ) : (
                  <p
                    className="border-line text-subtle border px-3 py-2 text-sm"
                  >
                    No matched baseline and recovery phases.
                  </p>
                )}
              </div>
            </div>

            {timing.length ? (
              <>
                <h3 className="mt-6 mb-2 text-sm font-semibold">
                  Transport Timing
                </h3>
                <DataTable
                  headers={['Timing', 'Samples', 'Average', 'P95', 'P99']}
                  rows={timing.map(([name, metric]) => [
                    label(name.replace('http_req_', '')),
                    integer.format(metric.count),
                    `${formatNumber(metric.avg)} ms`,
                    `${formatNumber(metric.p95)} ms`,
                    `${formatNumber(metric.p99)} ms`,
                  ])}
                />
              </>
            ) : null}
          </Section>

          <Section
            id="infrastructure"
            title="Infrastructure & Cost"
            note="Provider values are shown only when matching operator-supplied telemetry exists."
          >
            <p className="mb-4 text-sm">
              {report.providerTelemetry
                ? `Provider export ${report.providerTelemetry.source} covers ${report.providerTelemetry.windowStart} through ${report.providerTelemetry.windowEnd}. Window totals may include background traffic.`
                : 'No matching provider telemetry was attached. Infrastructure fields remain unavailable rather than inferred from client latency.'}
            </p>
            <DefinitionRows
              rows={Object.entries(report.infrastructure).map(
                ([name, value]) => [
                  label(name),
                  value === null ? 'Unavailable' : String(value),
                ]
              )}
            />
            <p className="text-subtle mt-3 text-sm">
              Estimated marginal request cost:{' '}
              <strong className="text-ink">
                {report.estimatedRequestCost === null
                  ? 'Unavailable'
                  : report.estimatedRequestCost}
              </strong>
              . Excludes CPU, storage, database operations, and egress.
            </p>
          </Section>

          <Section
            id="notes"
            title="Notes"
            note="Boundaries that must travel with the measurements."
          >
            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold">Limitations</h3>
                <ul className="text-subtle list-disc space-y-2 pl-5 text-sm">
                  {report.limitations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">
                  Next Measurements
                </h3>
                <ol className="text-subtle list-decimal space-y-2 pl-5 text-sm">
                  {report.recommendations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              </div>
            </div>
          </Section>
        </main>

        <footer
          className="border-ink text-subtle border-t-2 py-4 font-mono text-xs"
        >
          Local artifact · no remote assets, analytics, credentials, response
          bodies, or inferred provider metrics.
        </footer>
      </div>
    </>
  );
}
