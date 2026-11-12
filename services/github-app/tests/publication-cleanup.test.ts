import { describe, expect, test } from 'bun:test';

import { getOctokit } from '@/config/client.config';
import { runWithRuntimeConfig } from '@/config/runtime.config';
import { handleCleanupOperation } from '@/controllers/operation.controller';
import { InMemoryOperationStore } from '@/operations/in-memory-operation.store';
import {
  cleanupFailedPullRequest,
  OperationCleanupConflictError,
} from '@/operations/operation.cleanup';
import { OperationRecordSchema } from '@/operations/operation.types';
import { inspectPublication } from '@/operations/publication';
import type { GithubAppRuntimeConfig } from '@/types/env';

const config: GithubAppRuntimeConfig = {
  GITHUB_APP_ID: '123',
  GITHUB_PRIVATE_KEY: 'test',
  GITHUB_INSTALLATION_ID: '456',
  GITHUB_OWNER: 'scs',
  GITHUB_PEOPLE_DATA_REPOSITORY: 'people-data',
  GITHUB_PROJECTS_DATA_REPOSITORY: 'data',
  X_INTERNAL_SECRET: 'internal',
  PORT: 3000,
};
const operationId = `op_${'a'.repeat(64)}`;
const headSha = 'b'.repeat(40);
const branch = `project/example-${'a'.repeat(12)}`;
const url = 'https://github.com/scs/data/pull/12';

const operation = OperationRecordSchema.parse({
  version: 1,
  operationId,
  idempotencyHash: 'c'.repeat(64),
  idempotencyKey: 'request-key-00000001',
  actor: { type: 'user', subjectId: 'person-0000000001' },
  resource: { type: 'project', id: 'example' },
  action: 'project.upsert',
  payload: {},
  correlationId: 'correlation-0001',
  status: 'succeeded',
  attempt: 1,
  maxAttempts: 3,
  createdAt: '2026-11-13T00:00:00.000Z',
  updatedAt: '2026-11-13T00:00:01.000Z',
  completedAt: '2026-11-13T00:00:01.000Z',
  outcome: { status: 'succeeded', pullRequest: { number: 12, url } },
});

function pull(overrides: Record<string, unknown> = {}) {
  return {
    number: 12,
    html_url: url,
    state: 'open',
    merged_at: null,
    merge_commit_sha: null,
    user: { type: 'Bot', login: 'scs-portal[bot]' },
    body: `<!-- scs-operation\noperationId: ${operationId}\nresourceType: project\nresourceId: example\n-->`,
    head: { ref: branch, sha: headSha, repo: { full_name: 'scs/data' } },
    base: { repo: { full_name: 'scs/data' } },
    ...overrides,
  };
}

function client(input: {
  currentPull?: ReturnType<typeof pull>;
  checkConclusion?: string | null;
  deployed?: boolean;
  onClose?: () => void;
  onDelete?: () => void;
}) {
  const current = input.currentPull ?? pull();
  return {
    apps: {
      getInstallation: async () => ({
        data: { app_id: 123, app_slug: 'scs-portal' },
      }),
    },
    pulls: {
      get: async () => ({ data: current }),
      update: async () => {
        current.state = 'closed';
        input.onClose?.();
        return { data: current };
      },
    },
    checks: {
      listForRef: async () => ({
        data: {
          check_runs:
            input.checkConclusion === undefined
              ? []
              : [
                  {
                    name: 'Validate Public Data',
                    status: 'completed',
                    conclusion: input.checkConclusion,
                  },
                ],
        },
      }),
    },
    actions: {
      listWorkflowRuns: async () => ({
        data: {
          workflow_runs: input.deployed
            ? [{ conclusion: 'success', head_branch: 'main' }]
            : [],
        },
      }),
    },
    git: {
      getRef: async () => ({ data: { object: { sha: headSha } } }),
      deleteRef: async () => {
        input.onDelete?.();
        return { data: {} };
      },
    },
  } as unknown as ReturnType<typeof getOctokit>;
}

describe('publication reconciliation and cleanup', () => {
  test('does not treat PR creation as publication', async () => {
    const result = await runWithRuntimeConfig(config, () =>
      inspectPublication(operation, client({}))
    );
    expect(result).toMatchObject({ state: 'pr_open', cleanupEligible: false });
  });

  test('recognizes failed validation and verified deployment', async () => {
    const failed = await runWithRuntimeConfig(config, () =>
      inspectPublication(operation, client({ checkConclusion: 'failure' }))
    );
    expect(failed).toMatchObject({
      state: 'checks_failed',
      cleanupEligible: true,
    });

    const passed = await runWithRuntimeConfig(config, () =>
      inspectPublication(operation, client({ checkConclusion: 'success' }))
    );
    expect(passed.state).toBe('checks_passed');

    const merged = pull({
      state: 'closed',
      merged_at: '2026-11-13T00:03:00Z',
      merge_commit_sha: 'd'.repeat(40),
    });
    const published = await runWithRuntimeConfig(config, () =>
      inspectPublication(
        operation,
        client({ currentPull: merged, deployed: true })
      )
    );
    expect(published.state).toBe('published');
  });

  test('rejects unrelated and merged PRs before branch deletion', async () => {
    const unrelated = await runWithRuntimeConfig(config, () =>
      inspectPublication(
        operation,
        client({
          currentPull: pull({
            head: {
              ref: 'main',
              sha: headSha,
              repo: { full_name: 'scs/data' },
            },
          }),
          checkConclusion: 'failure',
        })
      )
    );
    expect(unrelated.cleanupEligible).toBe(false);

    const store = new InMemoryOperationStore();
    await store.create(operation);
    let deleted = false;
    await expect(
      runWithRuntimeConfig(config, () =>
        cleanupFailedPullRequest(
          operation,
          store,
          client({
            currentPull: pull({
              state: 'closed',
              merged_at: '2026-11-13T00:03:00Z',
            }),
            onDelete: () => {
              deleted = true;
            },
          })
        )
      )
    ).rejects.toBeInstanceOf(OperationCleanupConflictError);
    expect(deleted).toBe(false);
  });

  test('closes the trusted failed PR, deletes its branch, and is idempotent', async () => {
    const store = new InMemoryOperationStore();
    await store.create(operation);
    let closes = 0;
    let deletes = 0;
    const github = client({
      checkConclusion: 'failure',
      onClose: () => {
        closes++;
      },
      onDelete: () => {
        deletes++;
      },
    });
    const completed = await runWithRuntimeConfig(config, () =>
      cleanupFailedPullRequest(operation, store, github)
    );
    expect(completed.cleanup?.status).toBe('complete');
    const repeated = await runWithRuntimeConfig(config, () =>
      cleanupFailedPullRequest(completed, store, github)
    );
    expect(repeated.cleanup?.status).toBe('complete');
    expect([closes, deletes]).toEqual([1, 1]);
  });

  test('records a partial cleanup and retries branch deletion', async () => {
    const store = new InMemoryOperationStore();
    await store.create(operation);
    const currentPull = pull();
    let deleteAttempts = 0;
    const github = client({
      currentPull,
      checkConclusion: 'failure',
      onDelete: () => {
        deleteAttempts++;
        if (deleteAttempts === 1) throw new Error('temporary GitHub outage');
      },
    });
    await expect(
      runWithRuntimeConfig(config, () =>
        cleanupFailedPullRequest(operation, store, github)
      )
    ).rejects.toThrow('temporary GitHub outage');
    const partial = await store.get(operationId);
    expect(partial?.cleanup?.status).toBe('partial');
    const completed = await runWithRuntimeConfig(config, () =>
      cleanupFailedPullRequest(partial!, store, github)
    );
    expect(completed.cleanup?.status).toBe('complete');
    expect(deleteAttempts).toBe(2);
  });

  test('rejects cleanup for another actor', async () => {
    const store = new InMemoryOperationStore();
    await store.create(operation);
    const response = await handleCleanupOperation(
      new Request(`https://github-app.test/operations/${operationId}/cleanup`, {
        method: 'POST',
        headers: { 'X-Actor-Subject-Id': 'different-0000001' },
      }),
      { ...config, OPERATION_STORE: store },
      operationId
    );
    expect(response.status).toBe(403);
  });
});
