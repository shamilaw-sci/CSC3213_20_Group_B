import { expect, spyOn, test } from 'bun:test';

import * as clientConfig from '@/config/client.config';
import {
  parseRuntimeConfig,
  runWithRuntimeConfig,
} from '@/config/runtime.config';

import {
  createHonoursBulkCommand,
  createHonoursBulkHandler,
} from '@/domains/honours/honours.operation';
import {
  applyHonoursChange,
  createHonoursBulkRepository,
  HonoursBulkConflictError,
  honoursBranch,
} from '@/domains/honours/honours.repository';
import type { HonoursBulkOperationRequest } from '@scs/schemas';
import { InMemoryOperationStore } from '@/operations/in-memory-operation.store';
import { InMemoryMutationCoordinator } from '@/operations/mutation-coordinator';
import { OperationExecutor } from '@/operations/operation.executor';

const student = {
  title: 'Mr',
  fullName: 'Student',
  email: 's21801@sci.pdn.ac.lk',
  registrationNo: 'S21801',
  studentType: 'UNDERGRADUATE',
  studentTrack: 'GENERAL',
  level: '3000',
  status: 'CURRENT',
  personalEmail: 'student@example.com',
};

const requestFixture: HonoursBulkOperationRequest = {
  batch: 's21',
  operation: 'assign',
  programme: 'STATISTICS_AND_OPERATIONS_RESEARCH',
  reason: 'Department board approved the assignment',
  updatedBy: 'admin@sci.pdn.ac.lk',
  changes: [
    {
      identifier: 'S21801',
      oldTrack: 'GENERAL',
      oldProgramme: null,
      newTrack: 'HONOURS',
      newProgramme: 'STATISTICS_AND_OPERATIONS_RESEARCH',
    },
  ],
};

test('bulk change preserves unrelated profile fields and detects stale classification', () => {
  const change = {
    identifier: 'S21801' as const,
    oldTrack: 'GENERAL' as const,
    oldProgramme: null,
    newTrack: 'HONOURS' as const,
    newProgramme: 'STATISTICS_AND_OPERATIONS_RESEARCH' as const,
  };
  expect(applyHonoursChange(student, change)).toMatchObject({
    personalEmail: 'student@example.com',
    studentTrack: 'HONOURS',
    honoursProgramme: 'STATISTICS_AND_OPERATIONS_RESEARCH',
  });
  expect(() =>
    applyHonoursChange(
      {
        ...student,
        studentTrack: 'HONOURS',
        honoursProgramme: 'COMPUTER_SCIENCE',
      },
      change
    )
  ).toThrow(HonoursBulkConflictError);
});

test('bulk branch participates in the trusted profile projection workflow', () => {
  expect(honoursBranch('s21', `op_${'a'.repeat(32)}`)).toBe(
    `profile/s21-${'a'.repeat(12)}`
  );
});

test('bulk operation handler sends one request to the durable repository', async () => {
  const request: HonoursBulkOperationRequest = {
    batch: 's21',
    operation: 'assign',
    programme: 'STATISTICS_AND_OPERATIONS_RESEARCH',
    reason: 'Department board approved the assignment',
    updatedBy: 'admin@sci.pdn.ac.lk',
    changes: [
      {
        identifier: 'S21801',
        oldTrack: 'GENERAL',
        oldProgramme: null,
        newTrack: 'HONOURS',
        newProgramme: 'STATISTICS_AND_OPERATIONS_RESEARCH',
      },
    ],
  };
  const calls: unknown[] = [];
  const handler = createHonoursBulkHandler({
    async saveDraft(value, operationId) {
      calls.push({ value, operationId });
      return {
        revision: 'a'.repeat(40),
        pullRequest: {
          number: 1,
          url: 'https://github.com/example/repo/pull/1',
        },
      };
    },
  });
  const command = createHonoursBulkCommand({
    request,
    actorSubjectId: `usr_${'a'.repeat(64)}`,
    idempotencyKey: 'honours-batch-2026-0001',
    correlationId: 'corr_1234567890123456',
  });
  const result = await handler(command, {
    operationId: 'op_12345678901234567890',
  } as Parameters<typeof handler>[1]);
  expect(result).toMatchObject({
    status: 'succeeded',
    pullRequest: { number: 1 },
  });
  expect(calls).toHaveLength(1);
});

test('accepted Honours work completes after the client disconnects and finalization is idempotent', async () => {
  const store = new InMemoryOperationStore();
  let publications = 0;
  const handler = createHonoursBulkHandler({
    async saveDraft() {
      publications += 1;
      return {
        revision: 'a'.repeat(40),
        pullRequest: {
          number: 42,
          url: 'https://github.com/example/repo/pull/42',
        },
      };
    },
  });
  const options = {
    store,
    coordinator: new InMemoryMutationCoordinator(),
    handlers: { 'honours.bulk': handler },
    log: () => {},
  };
  const accepted = await new OperationExecutor(options).submit(
    createHonoursBulkCommand({
      request: requestFixture,
      actorSubjectId: `usr_${'a'.repeat(64)}`,
      idempotencyKey: 'honours-disconnect-0001',
      correlationId: 'corr_1234567890123456',
    })
  );
  expect(accepted.status).toBe('queued');
  expect(publications).toBe(0);
  // A new worker only needs the durable operation ID, not the request or browser.
  const recovered = new OperationExecutor(options);
  const completed = await recovered.execute(accepted.operationId);
  expect(completed.status).toBe('succeeded');
  expect((await store.get(accepted.operationId))?.outcome).toMatchObject({
    pullRequest: { number: 42 },
  });
  await recovered.execute(accepted.operationId);
  expect(publications).toBe(1);
});

test('retry restores labels on an existing Honours PR', async () => {
  const operationId = `op_${'a'.repeat(64)}`;
  const labels: unknown[] = [];
  let labelAttempts = 0;
  const pull = {
    number: 42,
    html_url: 'https://github.com/example/repo/pull/42',
    body: `<!-- scs-operation\noperationId: ${operationId}\nresourceType: honours_batch\nresourceId: s21\n-->`,
    head: { ref: honoursBranch('s21', operationId), sha: 'a'.repeat(40) },
  };
  const octokit = {
    pulls: { list: async () => ({ data: [pull] }) },
    issues: {
      addLabels: async (input: unknown) => {
        labelAttempts += 1;
        if (labelAttempts === 1) throw new Error('GitHub label request failed');
        labels.push(input);
      },
    },
  };
  const spy = spyOn(clientConfig, 'getOctokit').mockReturnValue(
    octokit as never
  );
  try {
    const config = parseRuntimeConfig({
      GITHUB_APP_ID: '1',
      GITHUB_PRIVATE_KEY: 'test',
      GITHUB_INSTALLATION_ID: '1',
      GITHUB_OWNER: 'example',
      GITHUB_PEOPLE_DATA_REPOSITORY: 'repo',
      GITHUB_PROJECTS_DATA_REPOSITORY: 'repo',
      X_INTERNAL_SECRET: 'test',
    });
    await expect(
      runWithRuntimeConfig(config, () =>
        createHonoursBulkRepository().saveDraft(requestFixture, operationId)
      )
    ).rejects.toThrow('GitHub label request failed');
    const result = await runWithRuntimeConfig(config, () =>
      createHonoursBulkRepository().saveDraft(
        { ...requestFixture, updatedBy: 'admin@sci.pdn.ac.lk' },
        operationId
      )
    );
    expect(result.pullRequest.number).toBe(42);
    expect(labelAttempts).toBe(2);
    expect(labels).toMatchObject([
      { issue_number: 42, labels: ['profile-update', 'auto-merge-profile'] },
    ]);
  } finally {
    spy.mockRestore();
  }
});

test('retry recognizes a Honours PR merged before operation finalization', async () => {
  const operationId = `op_${'b'.repeat(64)}`;
  const octokit = {
    pulls: {
      list: async (input: { state: string }) => ({
        data:
          input.state === 'open'
            ? []
            : [
                {
                  number: 43,
                  html_url: 'https://github.com/example/repo/pull/43',
                  body: `<!-- scs-operation\noperationId: ${operationId}\nresourceType: honours_batch\nresourceId: s21\n-->`,
                  merged_at: '2026-11-13T00:00:00Z',
                  head: {
                    ref: honoursBranch('s21', operationId),
                    sha: 'b'.repeat(40),
                  },
                },
              ],
      }),
    },
  };
  const spy = spyOn(clientConfig, 'getOctokit').mockReturnValue(
    octokit as never
  );
  try {
    const config = parseRuntimeConfig({
      GITHUB_APP_ID: '1',
      GITHUB_PRIVATE_KEY: 'test',
      GITHUB_INSTALLATION_ID: '1',
      GITHUB_OWNER: 'example',
      GITHUB_PEOPLE_DATA_REPOSITORY: 'repo',
      GITHUB_PROJECTS_DATA_REPOSITORY: 'repo',
      X_INTERNAL_SECRET: 'test',
    });
    const result = await runWithRuntimeConfig(config, () =>
      createHonoursBulkRepository().saveDraft(requestFixture, operationId)
    );
    expect(result).toMatchObject({
      revision: 'b'.repeat(40),
      pullRequest: { number: 43 },
    });
  } finally {
    spy.mockRestore();
  }
});

test('single and small-batch publication create one PR each across retries', async () => {
  const config = parseRuntimeConfig({
    GITHUB_APP_ID: '1',
    GITHUB_PRIVATE_KEY: 'test',
    GITHUB_INSTALLATION_ID: '1',
    GITHUB_OWNER: 'example',
    GITHUB_PEOPLE_DATA_REPOSITORY: 'repo',
    GITHUB_PROJECTS_DATA_REPOSITORY: 'repo',
    X_INTERNAL_SECRET: 'test',
  });
  for (const count of [1, 2]) {
    const operationId = `op_${String(count).repeat(64)}`;
    const request = {
      ...requestFixture,
      changes: Array.from({ length: count }, (_, index) => ({
        ...requestFixture.changes[0]!,
        identifier: `S2180${index + 1}`,
      })),
    } satisfies HonoursBulkOperationRequest;
    const blobs = new Map<string, string>();
    const branch = honoursBranch('s21', operationId);
    const refs = new Map([['heads/main', 'base-sha']]);
    const pulls: Array<{
      number: number;
      html_url: string;
      body: string;
      head: { ref: string; sha: string };
    }> = [];
    let commits = 0;
    let labels = 0;
    let created = 0;
    const octokit = {
      repos: { get: async () => ({ data: { default_branch: 'main' } }) },
      git: {
        getRef: async ({ ref }: { ref: string }) => {
          const sha = refs.get(ref);
          if (!sha)
            throw Object.assign(new Error('Not found'), { status: 404 });
          return { data: { object: { sha } } };
        },
        createRef: async ({ ref, sha }: { ref: string; sha: string }) => {
          refs.set(ref.replace('refs/', ''), sha);
          return { data: {} };
        },
        getTree: async () => ({
          data: {
            sha: 'base-tree',
            tree: request.changes.map((change) => {
              const sha = `original-${change.identifier}`;
              blobs.set(
                sha,
                JSON.stringify({
                  ...student,
                  registrationNo: change.identifier,
                  email: `${change.identifier.toLowerCase()}@sci.pdn.ac.lk`,
                })
              );
              return {
                path: `public/people/v2/users/${change.identifier.toLowerCase()}.json`,
                type: 'blob',
                sha,
              };
            }),
          },
        }),
        getBlob: async ({ file_sha }: { file_sha: string }) => ({
          data: { encoding: 'utf-8', content: blobs.get(file_sha) },
        }),
        getCommit: async () => ({ data: { tree: { sha: 'base-tree' } } }),
        createBlob: async ({ content }: { content: string }) => {
          const sha = `changed-${blobs.size}`;
          blobs.set(sha, content);
          return { data: { sha } };
        },
        createTree: async ({ tree }: { tree: unknown[] }) => {
          expect(tree).toHaveLength(count);
          return { data: { sha: 'next-tree' } };
        },
        createCommit: async () => {
          commits += 1;
          return { data: { sha: 'next-commit' } };
        },
        updateRef: async ({ ref, sha }: { ref: string; sha: string }) => {
          refs.set(ref, sha);
          return { data: { object: { sha } } };
        },
      },
      pulls: {
        list: async ({ state }: { state: string }) => ({
          data: state === 'open' ? pulls : [],
        }),
        create: async ({ body }: { body: string }) => {
          created += 1;
          const pull = {
            number: count,
            html_url: `https://github.com/example/repo/pull/${count}`,
            body,
            head: { ref: branch, sha: 'next-commit' },
          };
          pulls.push(pull);
          return { data: pull };
        },
      },
      issues: {
        addLabels: async () => {
          labels += 1;
          if (labels === 1) throw new Error('Label response lost');
        },
      },
    };
    const spy = spyOn(clientConfig, 'getOctokit').mockReturnValue(
      octokit as never
    );
    try {
      await expect(
        runWithRuntimeConfig(config, () =>
          createHonoursBulkRepository().saveDraft(request, operationId)
        )
      ).rejects.toThrow('Label response lost');
      const result = await runWithRuntimeConfig(config, () =>
        createHonoursBulkRepository().saveDraft(request, operationId)
      );
      expect(result.pullRequest.number).toBe(count);
      expect(created).toBe(1);
      expect(commits).toBe(1);
      expect(labels).toBe(2);
      expect(pulls[0]?.body).toContain(`operationId: ${operationId}`);
    } finally {
      spy.mockRestore();
    }
  }
});
