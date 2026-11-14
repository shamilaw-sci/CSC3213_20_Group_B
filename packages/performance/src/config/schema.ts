import { z } from 'zod';

const serviceNames = [
  'web',
  'people',
  'projects',
  'portal',
  'docs',
  'api',
  'data',
] as const;
export const profileNames = [
  'smoke',
  'baseline',
  'moderate',
  'high',
  'heavy',
  'extreme',
  'spike',
  'soak',
  'recovery',
] as const;
const journeyNames = [
  'mixed',
  'people',
  'search',
  'projects',
  'portal',
  'updates',
  'safe',
  'home',
  'static',
  'pagination',
  'validation',
  'authorization',
  'rate-limit',
  'timeout',
  'integrations',
] as const;
const label = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/);
const positive = z.number().positive();
const capsSchema = z.strictObject({
  vus: z.int().min(1).max(10000),
  rps: z.int().min(1).max(20000),
  seconds: z.int().min(1).max(14400),
  requests: z.int().min(1).max(10000000),
});
export const environmentSchema = z.strictObject({
  enabled: z.boolean(),
  kind: z.enum(['fixture', 'isolated', 'staging']),
  provider: z.enum(['local', 'cloudflare', 'vercel', 'other']),
  origins: z.partialRecord(z.enum(serviceNames), z.url()),
  isolatedDependencies: z.boolean(),
  allowWrites: z.boolean(),
  caps: capsSchema,
});
export const environmentsSchema = z.record(label, environmentSchema);
const sloSchema = z.strictObject({
  p95Ms: positive.default(800),
  p99Ms: positive.default(2000),
  failureRate: z.number().min(0).max(1).default(0.01),
  journeySuccessRate: z.number().min(0).max(1).default(0.99),
});
export const settingsSchema = z.strictObject({
  model: z.enum(['closed', 'open']).default('closed'),
  vus: z.int().min(1).max(10000).optional(),
  rate: z.int().min(1).max(20000).optional(),
  seconds: z.int().min(1).max(14400).optional(),
  maxRps: z.int().min(1).max(20000).optional(),
  requestBudget: z.int().min(1).max(10000000).optional(),
  journey: z.enum(journeyNames).default('mixed'),
  weights: z
    .strictObject({
      people: z.number().min(0),
      search: z.number().min(0),
      projects: z.number().min(0),
      portal: z.number().min(0),
      updates: z.number().min(0),
      safe: z.number().min(0),
    })
    .default({
      people: 30,
      search: 25,
      projects: 20,
      portal: 15,
      updates: 8,
      safe: 2,
    }),
  thinkSeconds: z
    .tuple([z.number().min(0).max(60), z.number().min(0).max(60)])
    .default([1, 3]),
  cache: z.enum(['warm', 'revalidate', 'mixed']).default('mixed'),
  slo: sloSchema.prefault({}),
  endpointSlo: z.record(label, sloSchema).default({}),
  sustainedSeconds: z.int().min(10).max(3600).default(60),
  maxDroppedRate: z.number().min(0).max(0.01).default(0),
  timeoutSeconds: z.number().min(0.1).max(30).default(10),
  requestCostPerThousand: z.number().nonnegative().optional(),
  maxEstimatedCost: z.number().nonnegative().optional(),
});
export const authorizationSchema = z.strictObject({
  id: label,
  approvedBy: label,
  reference: label,
  environment: label,
  revision: z.string().regex(/^[a-f0-9]{40}$/),
  expiresAt: z.iso.datetime(),
  origins: z.array(z.url()).min(1).max(7),
  caps: capsSchema,
  highLoad: z.boolean(),
  writes: z.boolean(),
  vercelApprovalReference: label.optional(),
});
export const sessionsSchema = z
  .array(
    z.strictObject({
      id: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,39}$/),
      email: z.string().regex(/^perf-[a-z0-9-]+@example\.invalid$/),
      cookie: z
        .string()
        .min(1)
        .max(8192)
        .regex(/^(?:__Secure-)?scs-auth\.session_token=[^;\r\n]+$/),
      originalName: z.string().regex(/^Perf Synthetic [a-zA-Z0-9 -]{1,60}$/),
    })
  )
  .max(10000);
export const fixturesSchema = z.strictObject({
  identities: z
    .array(z.string().regex(/^perf-[a-z0-9-]+$/))
    .min(1)
    .max(10000),
  projectSlugs: z
    .array(z.string().regex(/^perf-[a-z0-9-]+$/))
    .min(1)
    .max(10000),
  searchQueries: z
    .array(z.string().regex(/^[a-zA-Z0-9 -]{1,60}$/))
    .min(1)
    .max(100),
});
export type Environment = z.infer<typeof environmentSchema>;
type Settings = z.infer<typeof settingsSchema>;
export type Authorization = z.infer<typeof authorizationSchema>;
export type Session = z.infer<typeof sessionsSchema>[number];
export type Fixtures = z.infer<typeof fixturesSchema>;
export type Slo = z.infer<typeof sloSchema>;
export type Profile = (typeof profileNames)[number];

export type Phase = {
  name: string;
  seconds: number;
  target: number;
  steady: boolean;
};
export type Plan = {
  schemaVersion: 1;
  runId: string;
  environment: string;
  target: Environment;
  deploymentRevision: string;
  sourceRevision: string;
  profile: Profile;
  settings: Settings;
  vus: number;
  rate: number;
  seconds: number;
  maxRps: number;
  requestBudget: number;
  loadBudget: number;
  phases: Phase[];
  fixtures: Fixtures;
  sessionCount: number;
  writes: boolean;
  authenticated: boolean;
  diagnostic: boolean;
  approvalId: string | null;
  createdAt: string;
};
