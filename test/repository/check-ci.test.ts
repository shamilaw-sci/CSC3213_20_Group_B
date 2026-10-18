import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workflow = readFileSync(
  resolve(import.meta.dir, '../../.github/workflows/ci.yml'),
  'utf8'
);

describe('monorepo CI workflow', () => {
  test('runs for every pull request, merge group, and main push', () => {
    expect(workflow).toContain('pull_request:');
    expect(workflow).toContain('merge_group:');
    expect(workflow).toMatch(/push:\s+branches:\s+- main/);
    expect(workflow).not.toMatch(/^\s+paths:/m);
  });

  test('cancels only superseded pull request runs', () => {
    expect(workflow).toContain(
      'group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}'
    );
    expect(workflow).toContain(
      "cancel-in-progress: ${{ github.event_name == 'pull_request' }}"
    );
  });

  test('caches Bun downloads and Turbo output', () => {
    expect(workflow).toContain('uses: actions/cache@v4');
    expect(workflow).toContain('~/.bun/install/cache');
    expect(workflow).toContain('.turbo');
    expect(workflow).toContain("hashFiles('bun.lock')");
  });

  test('runs repository policy checks before workspace verification', () => {
    const docs = workflow.indexOf('run: bun run docs:check');
    const repositoryTests = workflow.indexOf('run: bun run test:repo');
    const format = workflow.indexOf('run: bun run format:check');
    const turbo = workflow.indexOf('bunx turbo run lint typecheck test build');

    expect(docs).toBeGreaterThan(-1);
    expect(repositoryTests).toBeGreaterThan(docs);
    expect(format).toBeGreaterThan(repositoryTests);
    expect(turbo).toBeGreaterThan(format);
  });

  test('lints pull request titles without interpolating them into shell code', () => {
    expect(workflow).toContain(
      'PR_TITLE: ${{ github.event.pull_request.title }}'
    );
    expect(workflow).toContain(
      'printf \'%s\\n\' "$PR_TITLE" | bunx commitlint'
    );
    expect(workflow).not.toContain(
      'echo "${{ github.event.pull_request.title }}"'
    );
  });

  test('uses affected verification only for pull requests', () => {
    expect(workflow).toContain("if: github.event_name == 'pull_request'");
    expect(workflow).toContain(
      'bunx turbo run lint typecheck test build --affected'
    );
    expect(workflow).toContain("if: github.event_name != 'pull_request'");
    expect(workflow).toContain('bun run lint');
    expect(workflow).toContain('bun run typecheck');
    expect(workflow).toContain('bun run test');
    expect(workflow).toContain('bun run build');
  });
});
