import { expect, test } from 'bun:test';
import { resolve } from 'node:path';

test('verification tooltip opens on keyboard focus', async () => {
  const workspace = resolve(import.meta.dir, '..');
  const child = Bun.spawn(
    [
      process.execPath,
      'test',
      './tests/fixtures/verified-orcid-tooltip.fixture.tsx',
    ],
    { cwd: workspace, stdout: 'pipe', stderr: 'pipe' }
  );
  const [code, error] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
  ]);
  if (code !== 0) throw new Error(error);
  expect(code).toBe(0);
});
