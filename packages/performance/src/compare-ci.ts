import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { compareReports } from '@/compare';
import { comparisonSchema } from '@/config/artifacts';
import { packageRoot, readJson, resultsRoot } from '@/config/runtime';

async function singleReport(directory: string) {
  const files = await Array.fromAsync(
    new Bun.Glob('**/report.json').scan({ cwd: directory, absolute: true })
  );
  if (files.length !== 1)
    throw new Error('Expected exactly one report in the selected artifact.');
  return {
    path: files[0],
    report: comparisonSchema.parse(await readJson(files[0])),
  };
}

try {
  const baseline = await singleReport(resolve(packageRoot, '.cache/baseline'));
  const current = await singleReport(resultsRoot);
  const comparison = compareReports(baseline.report, current.report);
  await writeFile(
    resolve(dirname(current.path), 'comparison.json'),
    JSON.stringify(comparison, null, 2)
  );
  process.stdout.write(JSON.stringify(comparison, null, 2) + '\n');
  process.exitCode = comparison.pass ? 0 : 1;
} catch {
  process.stderr.write(
    'Baseline comparison failed: verify report schemas, workload compatibility, and one artifact per run.\n'
  );
  process.exitCode = 1;
}
