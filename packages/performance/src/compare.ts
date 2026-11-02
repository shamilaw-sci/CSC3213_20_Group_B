import type { ComparisonReport } from '@/config/artifacts';

export function compareReports(
  baseline: ComparisonReport,
  current: ComparisonReport,
  tolerance = 0.1
) {
  if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 1)
    throw new Error('Regression tolerance must be between 0 and 1.');
  const comparable = (r: ComparisonReport) =>
    JSON.stringify({
      environment: r.plan.environment,
      target: r.plan.target,
      engine: r.state.engine,
      profile: r.plan.profile,
      settings: r.plan.settings,
      vus: r.plan.vus,
      rate: r.plan.rate,
      seconds: r.plan.seconds,
      maxRps: r.plan.maxRps,
      requestBudget: r.plan.requestBudget,
      fixtures: r.plan.fixtures,
      sessionCount: r.plan.sessionCount,
    });
  if (
    baseline.verdict !== 'PASS' ||
    current.verdict === 'INVALID' ||
    comparable(baseline) !== comparable(current)
  ) {
    throw new Error(
      'Comparison requires a passing baseline and matched, valid environments, fixtures and workload settings.'
    );
  }
  const failures: string[] = [];
  for (const percentile of ['p95', 'p99'] as const) {
    const before = baseline.metrics.latency[percentile];
    const after = current.metrics.latency[percentile];
    if (before === null || after === null || after > before * (1 + tolerance))
      failures.push(`${percentile} latency regression`);
  }
  if (
    current.metrics.successfulRps <
    baseline.metrics.successfulRps * (1 - tolerance)
  )
    failures.push('Successful throughput regression');
  if (current.verdict !== 'PASS') failures.push('Current SLO failure');
  return {
    pass: failures.length === 0,
    tolerance,
    baselineRun: baseline.plan.runId,
    currentRun: current.plan.runId,
    failures,
    note: 'A paired observation, not statistical significance. Repeat matched runs before attributing a regression to a revision.',
  };
}
