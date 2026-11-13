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

  test('uses Node 24 actions and caches Bun downloads and Turbo output', () => {
    expect(workflow).toContain('uses: actions/checkout@v7');
    expect(workflow).toContain('uses: actions/cache@v6');
    expect(workflow).toContain('~/.bun/install/cache');
    expect(workflow).toContain('.turbo');
    expect(workflow).toContain("hashFiles('bun.lock')");
  });

  test('runs repository policy checks before workspace verification', () => {
    const docs = workflow.indexOf('run: bun run docs:check');
    const repositoryTests = workflow.indexOf('run: bun run test:repo');
    const knip = workflow.indexOf('run: bun run knip');
    const format = workflow.indexOf('run: bun run format:check');
    const turbo = workflow.indexOf(
      'bunx turbo run lint --affected --concurrency=1'
    );

    expect(docs).toBeGreaterThan(-1);
    expect(repositoryTests).toBeGreaterThan(docs);
    expect(knip).toBeGreaterThan(repositoryTests);
    expect(format).toBeGreaterThan(knip);
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
      'bunx turbo run lint --affected --concurrency=1'
    );
    expect(workflow).toContain(
      'bunx turbo run typecheck typecheck:test test build --affected'
    );
    expect(workflow).toContain("if: github.event_name != 'pull_request'");
    expect(workflow).toContain('bunx turbo run lint --concurrency=1');
    expect(workflow).toContain('bun run typecheck');
    expect(workflow).toContain('bun run typecheck:test');
    expect(workflow).toContain('bun run test');
    expect(workflow).toContain('bun run build');
  });
});
