import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { runBrowser } from '@/browser';
import { compareReports } from '@/compare';
import { comparisonSchema } from '@/config/artifacts';
import { validateTarget } from '@/config/plan';
import { loadPlan, packageRoot, readJson, resultsRoot } from '@/config/runtime';
import { environmentsSchema, settingsSchema } from '@/config/schema';
import { regenerateReport, runK6 } from '@/runner';

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    strict: true,
    options: {
      environment: { type: 'string' },
      profile: { type: 'string' },
      settings: { type: 'string' },
      run: { type: 'string' },
      baseline: { type: 'string' },
      current: { type: 'string' },
      tolerance: { type: 'string' },
      telemetry: { type: 'string' },
      'dry-run': { type: 'boolean' },
      'local-check': { type: 'boolean' },
    },
  });
  const command = positionals[0];
  if (positionals.length !== 1)
    throw new Error(
      'Use one command: check, run, browser, report, compare, or cancel.'
    );
  if (command === 'check') {
    const environments = environmentsSchema.parse(
      await readJson(resolve(packageRoot, 'config/environments.json'))
    );
    for (const target of Object.values(environments))
      if (target.enabled) validateTarget(target);
    for (const file of [
      'settings.example',
      'public-closed',
      'public-open',
      'mixed-closed',
      'mixed-open',
    ])
      settingsSchema.parse(
        await readJson(resolve(packageRoot, `config/${file}.json`))
      );
    process.stdout.write(
      'Performance configuration valid. Disabled environments remain unavailable.\n'
    );
    return;
  }
  if (command === 'compare') {
    if (!values.baseline || !values.current)
      throw new Error('Supply --baseline and --current report JSON files.');
    const comparison = compareReports(
      comparisonSchema.parse(await readJson(resolve(values.baseline))),
      comparisonSchema.parse(await readJson(resolve(values.current))),
      values.tolerance === undefined ? 0.1 : Number(values.tolerance)
    );
    process.stdout.write(JSON.stringify(comparison, null, 2) + '\n');
    process.exitCode = comparison.pass ? 0 : 1;
    return;
  }
  if (command === 'report' || command === 'cancel') {
    if (!values.run || !/^perf-[0-9]{17}-[a-f0-9]{8}$/.test(values.run))
      throw new Error('Supply --run with the generated run ID.');
    const directory = resolve(resultsRoot, values.run);
    if (command === 'cancel') {
      await writeFile(resolve(directory, 'CANCEL'), 'cancel\n');
      return;
    }
    const report = await regenerateReport(
      directory,
      values.telemetry ? resolve(values.telemetry) : undefined
    );
    process.stdout.write(`${report.verdict}: ${directory}\n`);
    process.exitCode = report.verdict === 'PASS' ? 0 : 1;
    return;
  }
  if (command !== 'run' && command !== 'browser')
    throw new Error('Unknown performance command.');
  const { plan, sessions } = await loadPlan({
    environment: values.environment,
    profile: values.profile,
    settings: values.settings,
    localCheck: values['local-check'],
  });
  if (values['dry-run']) {
    process.stdout.write(JSON.stringify(plan, null, 2) + '\n');
    return;
  }
  process.stdout.write(
    `Starting ${plan.runId}; ${plan.environment}; ${plan.profile}; cap ${plan.vus} VUs / ${plan.maxRps} RPS / ${plan.requestBudget} requests.\n`
  );
  const result =
    command === 'browser'
      ? await runBrowser(plan, sessions)
      : await runK6(plan, sessions);
  process.stdout.write(`${result.report.verdict}: ${result.directory}\n`);
  process.exitCode = result.report.verdict === 'PASS' ? 0 : 1;
}

if (import.meta.main)
  await main().catch((error: unknown) => {
    // Zod paths are safe, but arbitrary input, provider errors and session values must not reach logs.
    const safeMessage =
      error instanceof Error &&
      error.name === 'Error' &&
      !error.message.includes('scs-auth.session_token')
        ? error.message
        : 'Invalid performance configuration or credentials.';
    process.stderr.write(`${safeMessage}\n`);
    process.exitCode = 1;
  });
