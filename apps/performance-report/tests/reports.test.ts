import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, mock, test } from 'bun:test';

mock.module('server-only', () => ({}));

const { listReports, loadReport } = await import('@/lib/reports');

test('lists valid report runs and rejects path traversal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scs-report-viewer-'));
  const older = 'perf-20261102170000000-aaaaaaaa';
  const newer = 'perf-20261102180000000-bbbbbbbb';
  try {
    for (const runId of [older, newer]) {
      const directory = join(root, runId);
      await mkdir(directory);
      await writeFile(
        join(directory, 'report.json'),
        JSON.stringify({ schemaVersion: 1, plan: { runId } })
      );
    }
    await mkdir(join(root, 'not-a-report'));

    expect(await listReports(root)).toEqual([newer, older]);
    expect((await loadReport(newer, root))?.plan.runId).toBe(newer);
    expect(await loadReport('../outside', root)).toBeNull();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
