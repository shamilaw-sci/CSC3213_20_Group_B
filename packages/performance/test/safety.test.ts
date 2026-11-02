import { describe, expect, test } from 'bun:test';
import { input, plan, revision } from 'test/support';

import { allowedBrowserRequest } from '@/browser';
import { buildPlan, phasePlan } from '@/config/plan';
import { fixtureSessions } from '@/config/runtime';
import {
  authorizationSchema,
  environmentSchema,
  settingsSchema,
} from '@/config/schema';

describe('performance safety policy', () => {
  test('requires exact loopback origins and denies disabled or unsafe targets', () => {
    for (const origin of [
      'https://production.example.com',
      'http://127.0.0.1:47831/path',
      'http://user:secret@127.0.0.1:47831',
      'http://127.0.0.1.evil.test',
      'file:///tmp/test',
    ]) {
      const candidate = input();
      candidate.target.origins.web = origin;
      expect(() => buildPlan(candidate)).toThrow();
    }
    const disabled = input();
    disabled.target.enabled = false;
    expect(() => buildPlan(disabled)).toThrow('disabled');
    const dependencies = input();
    dependencies.target.isolatedDependencies = false;
    expect(() => buildPlan(dependencies)).toThrow('upstream');
  });
  test('rejects unknown settings, non-finite values and every workload cap', () => {
    for (const settings of [
      { vus: 26 },
      { seconds: 601 },
      { maxRps: 101 },
      { requestBudget: 60001 },
      { rate: Infinity },
      { target: 'https://example.com' },
    ]) {
      expect(() => buildPlan(input(settings))).toThrow();
    }
    expect(() => settingsSchema.parse({ weights: { people: 100 } })).toThrow();
    expect(() =>
      buildPlan(
        input({
          weights: {
            people: 99,
            search: 0,
            projects: 0,
            portal: 0,
            updates: 0,
            safe: 0,
          },
        })
      )
    ).toThrow('100');
  });
  test('guards write identities, budgets, arrival rates and cost estimates', () => {
    expect(() => buildPlan(input({ vus: 3 }))).toThrow('distinct account');
    expect(() => buildPlan(input({ requestBudget: 3 }))).toThrow('budget');
    expect(() => buildPlan(input({ model: 'open', rate: 26 }))).toThrow('RPS');
    expect(() => buildPlan(input({ maxEstimatedCost: 1 }))).toThrow('estimate');
    expect(() =>
      buildPlan(input({ maxEstimatedCost: 1, requestCostPerThousand: 100 }))
    ).toThrow('cost');
    const duplicate = input();
    duplicate.sessions[1] = duplicate.sessions[0];
    expect(() => buildPlan(duplicate)).toThrow('unique');
  });
  test('rejects cleanup that cannot fit its deadline including surplus accounts', () => {
    const candidate = input({ vus: 1, maxRps: 1, requestBudget: 200 });
    candidate.sessions = fixtureSessions(40);
    expect(() => buildPlan(candidate)).toThrow('paced cleanup');
    candidate.sessions = fixtureSessions(2);
    expect(buildPlan(candidate).writes).toBe(true);
  });
  test('verifies revision, expiry, provider approval, origins and exact approval ID', () => {
    const candidate = input({ journey: 'safe' });
    candidate.target = environmentSchema.parse({
      ...candidate.target,
      kind: 'staging',
      provider: 'vercel',
      origins: Object.fromEntries(
        Object.keys(candidate.target.origins).map((s) => [
          s,
          `https://${s}.perf.example.com`,
        ])
      ),
    });
    const authorization = authorizationSchema.parse({
      id: 'PERF-1',
      approvedBy: 'operator',
      reference: 'change-1',
      environment: 'local',
      revision,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      origins: Object.values(candidate.target.origins),
      caps: candidate.target.caps,
      highLoad: false,
      writes: false,
      vercelApprovalReference: 'vercel-1',
    });
    expect(() => buildPlan(candidate)).toThrow('authorization');
    expect(
      buildPlan({ ...candidate, authorization, approvalId: 'PERF-1' })
        .approvalId
    ).toBe('PERF-1');
    for (const change of [
      { revision: 'b'.repeat(40) },
      { expiresAt: new Date().toISOString() },
      { vercelApprovalReference: undefined },
      { origins: ['https://wrong.perf.example.com'] },
    ]) {
      expect(() =>
        buildPlan({
          ...candidate,
          authorization: { ...authorization, ...change },
          approvalId: 'PERF-1',
        })
      ).toThrow();
    }
    expect(() =>
      buildPlan({ ...candidate, authorization, approvalId: 'wrong' })
    ).toThrow();
  });
  test('high profiles need explicit high-load authorization even on isolated loopback', () => {
    const candidate = input({ vus: 1, seconds: 10, journey: 'safe' });
    expect(() => buildPlan({ ...candidate, profile: 'extreme' })).toThrow(
      'authorization'
    );
  });
  test('phase durations sum exactly and only plateaus qualify as sustained', () => {
    for (const name of ['smoke', 'spike', 'recovery', 'soak'] as const) {
      const phases = phasePlan(name, 127, 50);
      expect(phases.reduce((sum, phase) => sum + phase.seconds, 0)).toBe(127);
      expect(phases.some((p) => p.steady)).toBe(true);
    }
  });
  test('browser blocks external origins, OAuth, proxy creation and mutations', () => {
    const p = plan();
    expect(
      allowedBrowserRequest(p, `${p.target.origins.api}/api/me`, 'GET')
    ).toBe(true);
    for (const [url, method] of [
      ['https://github.com/login', 'GET'],
      [`${p.target.origins.api}/api/auth/sign-in/social`, 'POST'],
      [`${p.target.origins.api}/api/me/proxy`, 'GET'],
      [`${p.target.origins.api}/api/me`, 'PATCH'],
      [`${p.target.origins.portal}/logout`, 'GET'],
    ]) {
      expect(allowedBrowserRequest(p, url, method)).toBe(false);
    }
  });
});
