import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import { z } from 'zod';

import { buildPlan } from '@/config/plan';
import {
  authorizationSchema,
  environmentsSchema,
  fixturesSchema,
  profileNames,
  sessionsSchema,
} from '@/config/schema';

export const packageRoot = resolve(
  import.meta.dirname,
  basename(import.meta.dirname) === 'dist' ? '..' : '../..'
);
const repositoryRoot = resolve(packageRoot, '../..');
export const resultsRoot = resolve(packageRoot, 'results');
const runtimeSchema = z.object({
  CI: z.string().optional(),
  PERF_SESSIONS_JSON: z.string().optional(),
  PERF_SESSIONS_FILE: z.string().optional(),
  PERF_AUTHORIZATION_JSON: z.string().optional(),
  PERF_APPROVAL_ID: z.string().optional(),
  PERF_DEPLOYMENT_REVISION: z.string().optional(),
  PERF_K6_BINARY: z.string().default('k6'),
  PERF_ENVIRONMENTS_FILE: z.string().optional(),
  PERF_BROWSER_EXECUTABLE: z.string().optional(),
});
export const runtime = runtimeSchema.parse(process.env);
export const childSystemEnvironment = {
  PATH: process.env.PATH ?? '',
  SystemRoot: process.env.SystemRoot ?? '',
  TEMP: process.env.TEMP ?? '',
  TMP: process.env.TMP ?? '',
};

export async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

export function fixtureSessions(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `fixture-${i + 1}`,
    email: `perf-${i + 1}@example.invalid`,
    cookie: `scs-auth.session_token=fixture-${i + 1}`,
    originalName: `Perf Synthetic ${i + 1}`,
  }));
}

export async function loadPlan(args: {
  environment?: string;
  profile?: string;
  settings?: string;
  localCheck?: boolean;
}) {
  if (!args.environment) throw new Error('Select --environment explicitly.');
  if (runtime.CI && runtime.PERF_ENVIRONMENTS_FILE)
    throw new Error('CI cannot override the checked-in target allowlist.');
  const environments = environmentsSchema.parse(
    await readJson(
      runtime.PERF_ENVIRONMENTS_FILE ??
        resolve(packageRoot, 'config/environments.json')
    )
  );
  const target = environments[args.environment];
  if (!target) throw new Error('Unknown environment.');
  const profile = z.enum(profileNames).parse(args.profile ?? 'smoke');
  if (args.localCheck && target.kind !== 'fixture')
    throw new Error('Local verification must target the fixture.');
  const settings = args.localCheck
    ? {
        vus: 1,
        seconds: 3,
        journey: 'safe',
        thinkSeconds: [0.1, 0.2],
        maxRps: 10,
        requestBudget: 40,
      }
    : args.settings
      ? await readJson(resolve(args.settings))
      : {};
  if (runtime.PERF_SESSIONS_JSON && runtime.PERF_SESSIONS_FILE)
    throw new Error('Select one synthetic-session source.');
  const sessions = sessionsSchema.parse(
    runtime.PERF_SESSIONS_FILE
      ? await readJson(runtime.PERF_SESSIONS_FILE)
      : runtime.PERF_SESSIONS_JSON
        ? (JSON.parse(runtime.PERF_SESSIONS_JSON) as unknown)
        : target.kind === 'fixture'
          ? fixtureSessions(25)
          : []
  );
  const authorization = runtime.PERF_AUTHORIZATION_JSON
    ? authorizationSchema.parse(
        JSON.parse(runtime.PERF_AUTHORIZATION_JSON) as unknown
      )
    : undefined;
  const revision = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], {
    cwd: repositoryRoot,
  });
  if (revision.exitCode !== 0)
    throw new Error('Cannot determine source revision.');
  const sourceRevision = revision.stdout.toString().trim();
  if (target.provider !== 'local' && !runtime.PERF_DEPLOYMENT_REVISION)
    throw new Error('PERF_DEPLOYMENT_REVISION is required for hosted tests.');
  const plan = buildPlan({
    environment: args.environment,
    target,
    profile,
    settings,
    fixtures: fixturesSchema.parse(
      await readJson(resolve(packageRoot, 'fixtures/synthetic.json'))
    ),
    sessions,
    authorization,
    approvalId: runtime.PERF_APPROVAL_ID,
    revision: runtime.PERF_DEPLOYMENT_REVISION ?? sourceRevision,
    sourceRevision,
  });
  return { plan, sessions };
}
