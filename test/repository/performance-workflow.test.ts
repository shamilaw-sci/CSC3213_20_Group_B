import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');
type Workflow = {
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  concurrency: { group: string; 'cancel-in-progress': boolean };
  jobs: Record<
    string,
    {
      if: string;
      environment?: string;
      'timeout-minutes': number;
      steps: {
        name?: string;
        uses?: string;
        run?: string;
        env?: Record<string, string>;
        with?: Record<string, unknown>;
      }[];
    }
  >;
};
function readWorkflow(name: string) {
  return Bun.YAML.parse(
    readFileSync(resolve(root, '.github/workflows', name), 'utf8')
  ) as Workflow;
}

describe('performance workflow boundaries', () => {
  for (const name of ['performance.yml', 'performance-smoke.yml']) {
    test(`${name} is manual and protects hosted execution`, () => {
      const workflow = readWorkflow(name);
      expect(Object.keys(workflow.on)).toEqual(['workflow_dispatch']);
      expect(workflow.permissions.contents).toBe('read');
      expect(workflow.concurrency['cancel-in-progress']).toBe(false);
      for (const [key, job] of Object.entries(workflow.jobs)) {
        expect(job['timeout-minutes']).toBeLessThanOrEqual(270);
        if (key === 'fixture') continue;
        expect(job.if).toContain("github.ref == 'refs/heads/main'");
        expect(job.if).toContain(
          "github.repository == 'csc3213-2026-group-b/scs-pdn-monorepo'"
        );
        expect(job.environment).toStartWith('performance-');
        expect(
          job.steps.some(
            (step) => step.env?.PERF_ENABLED === '${{ vars.PERF_ENABLED }}'
          )
        ).toBe(true);
        expect(
          job.steps.some(
            (step) =>
              step.env?.PERF_AUTHORIZATION_JSON ===
              '${{ vars.PERF_AUTHORIZATION_JSON }}'
          )
        ).toBe(true);
        for (const step of job.steps) {
          expect(step.run ?? '').not.toContain('${{ inputs.');
          if (step.uses?.startsWith('actions/upload-artifact')) {
            const path = String(step.with?.path);
            expect(path).toContain('/report.json');
            expect(path).not.toContain('metrics.ndjson');
            expect(path).not.toContain('*.json');
          }
        }
      }
    });
  }
  test('local job cannot access synthetic credentials and always uses the minimal check', () => {
    const fixture = readWorkflow('performance.yml').jobs.fixture;
    expect(JSON.stringify(fixture)).not.toContain('secrets.');
    expect(
      fixture.steps.some((step) => step.run === 'bun run perf:verify-local')
    ).toBe(true);
  });
});
