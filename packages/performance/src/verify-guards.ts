import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { runBrowser } from '@/browser';
import { buildPlan } from '@/config/plan';
import { loadPlan, resultsRoot } from '@/config/runtime';
import { startFixture } from '@/fixture-server';
import { regenerateReport, runK6 } from '@/runner';

/* Explicit integration verification only: ordinary tests never launch k6 or Chromium. */
const fixture = startFixture();
try {
  const loaded = await loadPlan({ environment: 'local', localCheck: true });
  const sessions = loaded.sessions.slice(0, 1);
  const makePlan = (settings: Record<string, unknown>) =>
    buildPlan({
      environment: 'local',
      target: loaded.plan.target,
      profile: 'smoke',
      settings: {
        vus: 1,
        seconds: 2,
        maxRps: 20,
        requestBudget: 60,
        thinkSeconds: [0.2, 0.3],
        ...settings,
      },
      fixtures: loaded.plan.fixtures,
      sessions,
      revision: loaded.plan.deploymentRevision,
      sourceRevision: loaded.plan.sourceRevision,
    });
  for (const journey of [
    'updates',
    'validation',
    'pagination',
    'integrations',
  ]) {
    const p = makePlan({ journey });
    const before = fixture.requestCount();
    const result = await runK6(p, sessions);
    assert.equal(
      result.report.verdict,
      'PASS',
      `${journey}: ${JSON.stringify(result.report.invalidReasons)}`
    );
    assert.ok(fixture.requestCount() - before <= p.requestBudget);
    if (journey === 'updates') {
      assert.equal(result.report.state.cleanup, 'passed');
      assert.equal(
        fixture.names.get(sessions[0].cookie),
        sessions[0].originalName
      );
    }
    assert.equal(
      (await regenerateReport(result.directory)).verdict,
      result.report.verdict
    );
    process.stdout.write(`Verified ${journey}: ${result.directory}\n`);
  }
  const open = await runK6(
    makePlan({ journey: 'safe', model: 'open', rate: 1 }),
    sessions
  );
  assert.equal(open.report.verdict, 'PASS');
  const budgetPlan = makePlan({
    journey: 'safe',
    requestBudget: 4,
    thinkSeconds: [0, 0],
  });
  const beforeBudget = fixture.requestCount();
  const budget = await runK6(budgetPlan, sessions);
  assert.equal(budget.report.verdict, 'INVALID');
  assert.ok(fixture.requestCount() - beforeBudget <= 4);
  const fault = await runK6(
    makePlan({ journey: 'timeout', timeoutSeconds: 0.1 }),
    sessions
  );
  assert.notEqual(fault.report.verdict, 'PASS');
  assert.ok(fault.report.metrics.classes.timeout > 0);
  const preCancelledPlan = makePlan({ journey: 'updates' });
  const preCancelledDirectory = resolve(resultsRoot, preCancelledPlan.runId);
  await mkdir(preCancelledDirectory, { recursive: true });
  await writeFile(resolve(preCancelledDirectory, 'CANCEL'), 'cancel');
  const beforePreflight = fixture.requestCount();
  const preCancelled = await runK6(preCancelledPlan, sessions);
  assert.equal(preCancelled.report.verdict, 'INVALID');
  assert.equal(fixture.requestCount(), beforePreflight);
  const cancelPlan = makePlan({ journey: 'updates', seconds: 10 });
  const cancelDirectory = resolve(resultsRoot, cancelPlan.runId);
  const marker = setInterval(() => {
    if (existsSync(cancelDirectory))
      void writeFile(resolve(cancelDirectory, 'CANCEL'), 'cancel');
  }, 500);
  try {
    const cancelled = await runK6(cancelPlan, sessions);
    assert.equal(cancelled.report.verdict, 'INVALID');
    assert.equal(cancelled.report.state.cleanup, 'passed');
    assert.equal(
      fixture.names.get(sessions[0].cookie),
      sessions[0].originalName
    );
  } finally {
    clearInterval(marker);
  }
  const browser = await runBrowser(
    makePlan({ journey: 'safe', seconds: 30, maxRps: 20, requestBudget: 200 }),
    sessions
  );
  assert.equal(
    browser.report.verdict,
    'PASS',
    JSON.stringify(browser.report.invalidReasons)
  );
  process.stdout.write(
    `Verified open arrivals, budget stop, timeout classification, cancellation cleanup and browser journeys. Browser: ${browser.directory}\n`
  );
} finally {
  fixture.server.stop(true);
}
