type Summary = {
  count: number;
  avg: number | null;
  p50: number | null;
  p90: number | null;
  p95: number | null;
  p99: number | null;
};

type Metrics = {
  attempted: number;
  completed: number;
  successful: number;
  attemptedRps: number | null;
  completedRps: number | null;
  successfulRps: number | null;
  failureRate: number | null;
  journeySuccessRate: number | null;
  journeysCompleted: number;
  maxVus: number | null;
  latency: Summary;
  classes: Record<string, number>;
  endpoints: Record<string, { latency: Summary; failureRate: number | null }>;
};

export type ReportData = {
  schemaVersion: 1;
  verdict: 'PASS' | 'FAIL' | 'INVALID';
  durationSeconds: number | null;
  plan: {
    runId: string;
    environment: string;
    profile: string;
    deploymentRevision: string;
    sourceRevision: string;
    rate: number;
    vus: number;
    maxRps: number;
    target: { kind: string };
    settings: {
      model: 'open' | 'closed';
      journey: string;
      slo: { p95Ms: number; p99Ms: number; failureRate: number };
    };
  };
  state: {
    engine: string;
    startedAt: string;
    cleanup: string;
    generator: {
      maxCpuRatio: number | null;
      minFreeMemoryRatio: number | null;
      maxTimerLagMs: number | null;
      saturated: boolean;
    };
  };
  invalidReasons: string[];
  thresholds: { failures: string[] };
  observations: string[];
  metrics: Metrics;
  buckets: Array<{
    second: number;
    attemptedRps: number | null;
    completedRps: number | null;
    successfulRps: number | null;
    latency: Summary;
    failureRate: number | null;
    maxVus: number | null;
    droppedIterations: number;
  }>;
  phases: Array<{
    name: string;
    seconds: number;
    target: number;
    metrics: Metrics;
    thresholds: { pass: boolean };
  }>;
  timing: Record<string, Summary>;
  infrastructure: Record<string, number | null>;
  providerTelemetry: null | {
    source: string;
    windowStart: string;
    windowEnd: string;
  };
  estimatedRequestCost: number | null;
  observedCapacity: null | {
    completedRps: number;
    sustainedSeconds: number;
    phase: string;
  };
  recovery: null | {
    baselineP95Ms: number | null;
    recoveryP95Ms: number | null;
    recoveryCompletedRps: number | null;
    note: string;
  };
  limitations: string[];
  recommendations: string[];
};
