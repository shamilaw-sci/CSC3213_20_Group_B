import { safetyLimits } from '@/config/limits';
import type {
  Authorization,
  Environment,
  Fixtures,
  Phase,
  Plan,
  Profile,
  Session,
} from '@/config/schema';
import { settingsSchema } from '@/config/schema';

const profiles: Record<
  Profile,
  { vus: number; rate: number; seconds: number }
> = {
  smoke: { vus: 2, rate: 1, seconds: 120 },
  baseline: { vus: 15, rate: 5, seconds: 300 },
  moderate: { vus: 75, rate: 25, seconds: 600 },
  high: { vus: 350, rate: 100, seconds: 600 },
  heavy: { vus: 1500, rate: 500, seconds: 600 },
  extreme: { vus: 5000, rate: 2000, seconds: 600 },
  spike: { vus: 350, rate: 100, seconds: 600 },
  soak: { vus: 75, rate: 25, seconds: 7200 },
  recovery: { vus: 75, rate: 25, seconds: 600 },
};

export function phasePlan(
  profile: Profile,
  seconds: number,
  target: number
): Phase[] {
  if (seconds < 10) return [{ name: 'steady', seconds, target, steady: true }];
  if (profile === 'spike' || profile === 'recovery') {
    const unit = Math.floor(seconds / 10);
    const base = Math.max(1, Math.floor(target / 10));
    return [
      { name: 'baseline', seconds: 2 * unit, target: base, steady: true },
      { name: 'surge', seconds: unit, target, steady: false },
      { name: 'peak', seconds: 2 * unit, target, steady: true },
      { name: 'settle', seconds: unit, target: base, steady: false },
      {
        name: 'recovery',
        seconds: seconds - 6 * unit,
        target: base,
        steady: true,
      },
    ];
  }
  const ramp = Math.max(1, Math.floor(seconds / 10));
  return [
    { name: 'warmup', seconds: ramp, target, steady: false },
    { name: 'steady', seconds: seconds - 2 * ramp, target, steady: true },
    { name: 'cooldown', seconds: ramp, target: 0, steady: false },
  ];
}

export function validateTarget(target: Environment): void {
  if (!target.enabled)
    throw new Error(
      'Environment is disabled; configure and review its allowlist first.'
    );
  if (!target.isolatedDependencies)
    throw new Error(
      'Isolated upstream dependencies must be verified before testing.'
    );
  for (const service of [
    'web',
    'people',
    'projects',
    'portal',
    'docs',
    'api',
    'data',
  ] as const) {
    const value = target.origins[service];
    if (!value) throw new Error(`Missing ${service} origin.`);
    const url = new URL(value);
    if (
      url.origin !== value ||
      url.username ||
      url.password ||
      url.hash ||
      url.search
    ) {
      throw new Error(
        'Targets must be bare origins, without credentials, paths, queries or fragments.'
      );
    }
    const loopback = ['127.0.0.1', '[::1]'].includes(url.hostname);
    if (target.provider === 'local' || target.kind === 'fixture') {
      if (!loopback || url.protocol !== 'http:')
        throw new Error(
          'Local targets must use literal loopback HTTP origins.'
        );
    } else {
      if (
        url.protocol !== 'https:' ||
        !/(^|[.-])(staging|perf|test|preview)([.-]|$)/i.test(url.hostname)
      ) {
        throw new Error(
          'Hosted targets must use HTTPS and a staging, perf, test or preview hostname. Production is unsupported.'
        );
      }
    }
  }
}

export function buildPlan(input: {
  environment: string;
  target: Environment;
  profile: Profile;
  settings: unknown;
  fixtures: Fixtures;
  sessions: Session[];
  authorization?: Authorization;
  approvalId?: string;
  revision: string;
  sourceRevision: string;
  now?: Date;
}): Plan {
  validateTarget(input.target);
  const settings = settingsSchema.parse(input.settings);
  const defaults = profiles[input.profile];
  const vus = settings.vus ?? defaults.vus;
  const rate = settings.rate ?? defaults.rate;
  const seconds = settings.seconds ?? defaults.seconds;
  const maxRps = settings.maxRps ?? input.target.caps.rps;
  const requestBudget =
    settings.requestBudget ??
    Math.min(input.target.caps.requests, maxRps * (seconds + 30));
  const weights = settings.weights;
  if (
    Math.abs(Object.values(weights).reduce((a, b) => a + b, 0) - 100) > 0.00001
  ) {
    throw new Error('Journey weights must sum to 100.');
  }
  if (settings.thinkSeconds[0] > settings.thinkSeconds[1])
    throw new Error('Invalid think-time range.');
  if (settings.slo.p99Ms < settings.slo.p95Ms)
    throw new Error('P99 SLO must be at least P95.');
  const writes =
    settings.journey === 'updates' ||
    (settings.journey === 'mixed' && weights.updates > 0);
  const authenticated =
    writes ||
    ['portal', 'pagination', 'validation', 'rate-limit'].includes(
      settings.journey
    ) ||
    (settings.journey === 'mixed' && weights.portal > 0);
  const diagnostic = [
    'validation',
    'authorization',
    'timeout',
    'rate-limit',
    'integrations',
  ].includes(settings.journey);
  if (
    ['timeout', 'integrations'].includes(settings.journey) &&
    input.target.kind !== 'fixture'
  ) {
    throw new Error(
      'Fault injection and external integration adapters are fixture-only.'
    );
  }
  if (writes && !input.target.allowWrites)
    throw new Error('Synthetic writes are disabled for this environment.');
  if (authenticated && input.sessions.length < (writes ? vus : 1)) {
    throw new Error(
      'Supply synthetic sessions; writes require one distinct account per maximum VU.'
    );
  }
  if (
    new Set(input.sessions.map((s) => s.email)).size !==
      input.sessions.length ||
    new Set(input.sessions.map((s) => s.cookie)).size !== input.sessions.length
  ) {
    throw new Error('Synthetic session accounts and cookies must be unique.');
  }
  if (settings.model === 'open' && rate * 4 > maxRps)
    throw new Error(
      'Peak arrival rate times four requests per journey exceeds the RPS safety ceiling.'
    );
  if (requestBudget < vus * 4 + (writes ? input.sessions.length * 3 : 0))
    throw new Error(
      'Request budget is too small for the VUs and cleanup reserve.'
    );
  const caps = { vus, rps: maxRps, seconds, requests: requestBudget };
  /*
   * Cleanup covers every supplied account, including surplus sessions. Reserve
   * one final request timeout beyond minimum pacing; network failures can still
   * make cleanup fail, but a plan must not make it impossible before it starts.
   */
  if (
    writes &&
    (input.sessions.length * 2 * 1000) / maxRps +
      safetyLimits.controlRequestMs >=
      safetyLimits.controlPhaseMs
  )
    throw new Error(
      'Synthetic account pool cannot fit paced cleanup within its deadline; reduce the pool or review the RPS cap.'
    );
  for (const key of ['vus', 'rps', 'seconds', 'requests'] as const) {
    if (caps[key] > input.target.caps[key])
      throw new Error(`Environment ${key} cap exceeded.`);
  }
  if (
    settings.maxEstimatedCost !== undefined &&
    settings.requestCostPerThousand === undefined
  ) {
    throw new Error(
      'Cost budget requires an explicit per-thousand request estimate.'
    );
  }
  if (
    settings.maxEstimatedCost !== undefined &&
    (requestBudget / 1000) * settings.requestCostPerThousand! >
      settings.maxEstimatedCost
  ) {
    throw new Error('Estimated request cost exceeds budget.');
  }
  const highLoad =
    !['smoke', 'baseline'].includes(input.profile) ||
    vus > 25 ||
    maxRps > 100 ||
    seconds > 600 ||
    requestBudget > 60000;
  const needsApproval = highLoad || input.target.provider !== 'local';
  const now = input.now ?? new Date();
  if (needsApproval) {
    const a = input.authorization;
    if (
      !a ||
      input.approvalId !== a.id ||
      a.environment !== input.environment ||
      a.revision !== input.revision
    ) {
      throw new Error(
        'A matching, revision-bound authorization and PERF_APPROVAL_ID are required.'
      );
    }
    if (Date.parse(a.expiresAt) <= now.getTime() + (seconds + 180) * 1000)
      throw new Error(
        'Authorization expires before the run and cleanup finish.'
      );
    if (highLoad && !a.highLoad)
      throw new Error('High-load approval is missing.');
    if (writes && !a.writes) throw new Error('Write approval is missing.');
    if (input.target.provider === 'vercel' && !a.vercelApprovalReference)
      throw new Error('Vercel provider approval is missing.');
    const origins = [...new Set(Object.values(input.target.origins))].sort();
    if (
      JSON.stringify(origins) !== JSON.stringify([...new Set(a.origins)].sort())
    )
      throw new Error('Authorized origins do not match the target allowlist.');
    for (const key of ['vus', 'rps', 'seconds', 'requests'] as const) {
      if (caps[key] > a.caps[key])
        throw new Error(`Authorization ${key} cap exceeded.`);
    }
  }
  if (
    !/^[a-f0-9]{40}$/.test(input.revision) ||
    !/^[a-f0-9]{40}$/.test(input.sourceRevision)
  )
    throw new Error('Record full deployment and source commit SHAs.');
  return {
    schemaVersion: 1,
    runId: `perf-${now.toISOString().replace(/[^0-9]/g, '')}-${crypto.randomUUID().slice(0, 8)}`,
    environment: input.environment,
    target: input.target,
    deploymentRevision: input.revision,
    sourceRevision: input.sourceRevision,
    profile: input.profile,
    settings,
    vus,
    rate,
    seconds,
    maxRps,
    requestBudget,
    loadBudget: requestBudget - (writes ? input.sessions.length * 3 : 0),
    phases: phasePlan(
      input.profile,
      seconds,
      settings.model === 'open' ? rate : vus
    ),
    fixtures: input.fixtures,
    sessionCount: input.sessions.length,
    writes,
    authenticated,
    diagnostic,
    approvalId: needsApproval ? input.authorization!.id : null,
    createdAt: now.toISOString(),
  };
}
