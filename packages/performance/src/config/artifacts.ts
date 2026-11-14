import { z } from 'zod';

import {
  environmentSchema,
  fixturesSchema,
  profileNames,
  settingsSchema,
} from '@/config/schema';

const nonnegative = z.number().nonnegative();
const revision = z.string().regex(/^[a-f0-9]{40}$/);
export const savedPlanSchema = z.strictObject({
  schemaVersion: z.literal(1),
  runId: z.string().regex(/^perf-[0-9]{17}-[a-f0-9]{8}$/),
  environment: z.string().regex(/^[a-zA-Z0-9._-]{1,120}$/),
  target: environmentSchema,
  deploymentRevision: revision,
  sourceRevision: revision,
  profile: z.enum(profileNames),
  settings: settingsSchema,
  vus: z.int().positive().max(10000),
  rate: z.int().positive().max(20000),
  seconds: z.int().positive().max(14400),
  maxRps: z.int().positive().max(20000),
  requestBudget: z.int().positive().max(10000000),
  loadBudget: z.int().positive().max(10000000),
  phases: z
    .array(
      z.strictObject({
        name: z.string().regex(/^[a-z_]{1,30}$/),
        seconds: z.int().positive().max(14400),
        target: z.int().nonnegative().max(20000),
        steady: z.boolean(),
      })
    )
    .min(1)
    .max(10),
  fixtures: fixturesSchema,
  sessionCount: z.int().nonnegative().max(10000),
  writes: z.boolean(),
  authenticated: z.boolean(),
  diagnostic: z.boolean(),
  approvalId: z
    .string()
    .regex(/^[a-zA-Z0-9._-]{1,120}$/)
    .nullable(),
  createdAt: z.iso.datetime(),
});
export const runStateSchema = z.strictObject({
  engine: z.enum(['k6', 'playwright']),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime(),
  exitCode: z.int(),
  reason: z.string().max(500).nullable(),
  cleanup: z.enum(['not-needed', 'passed', 'failed']),
  cleanupFailedIds: z
    .array(z.string().regex(/^[a-zA-Z0-9._-]{1,40}$/))
    .max(10000),
  preparationRequests: z.int().nonnegative(),
  cleanupRequests: z.int().nonnegative(),
  generator: z.strictObject({
    samples: z.int().nonnegative(),
    maxCpuRatio: nonnegative.max(1).nullable(),
    minFreeMemoryRatio: nonnegative.max(1).nullable(),
    maxTimerLagMs: nonnegative.nullable(),
    saturated: z.boolean(),
  }),
});
export const comparisonSchema = z.object({
  schemaVersion: z.literal(1),
  plan: savedPlanSchema,
  state: z.object({ engine: z.enum(['k6', 'playwright']) }),
  verdict: z.enum(['PASS', 'FAIL', 'INVALID']),
  metrics: z.object({
    successfulRps: nonnegative,
    latency: z.object({
      p95: nonnegative.nullable(),
      p99: nonnegative.nullable(),
    }),
  }),
});
export type ComparisonReport = z.infer<typeof comparisonSchema>;

export const telemetrySchema = z.strictObject({
  runId: z.string().regex(/^perf-[0-9]{17}-[a-f0-9]{8}$/),
  deploymentRevision: revision,
  source: z.string().regex(/^[a-zA-Z0-9._-]{1,120}$/),
  windowStart: z.iso.datetime(),
  windowEnd: z.iso.datetime(),
  workerRequests: nonnegative.nullable(),
  workerCpuMs: nonnegative.nullable(),
  d1QueryMs: nonnegative.nullable(),
  d1RowsRead: nonnegative.nullable(),
  d1RowsWritten: nonnegative.nullable(),
  vercelFunctionMs: nonnegative.nullable(),
  vercelErrors: nonnegative.nullable(),
  thirdPartyFailures: nonnegative.nullable(),
  actualCost: nonnegative.nullable(),
});
export type ProviderTelemetry = z.infer<typeof telemetrySchema>;
export type InfrastructureMetrics = Omit<
  ProviderTelemetry,
  'runId' | 'deploymentRevision' | 'source' | 'windowStart' | 'windowEnd'
>;
