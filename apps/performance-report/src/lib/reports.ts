import 'server-only';

import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { ReportData } from '@/lib/report-types';

const runIdPattern = /^perf-\d{17}-[a-f0-9]{8}$/;

const defaultResultsRoot = resolve(
  process.cwd(),
  '../../packages/performance/results'
);

export async function listReports(root = defaultResultsRoot) {
  const entries = await readdir(/* turbopackIgnore: true */ root, {
    withFileTypes: true,
  }).catch(() => []);
  return entries
    .filter((entry) => entry.isDirectory() && runIdPattern.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .reverse();
}

export async function loadReport(runId: string, root = defaultResultsRoot) {
  if (!runIdPattern.test(runId)) return null;
  try {
    const value = JSON.parse(
      await readFile(
        /* turbopackIgnore: true */ resolve(root, runId, 'report.json'),
        'utf8'
      )
    ) as ReportData;
    return value.schemaVersion === 1 && value.plan.runId === runId
      ? value
      : null;
  } catch {
    return null;
  }
}
