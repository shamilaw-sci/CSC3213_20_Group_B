import { Buffer } from 'node:buffer';

import { describe, expect, test } from 'bun:test';
import type { Octokit } from '@octokit/rest';

import type { AcademicOperationRequest } from '@/domains/academics/academic.operation';
import {
  AcademicRevisionConflictError,
  GithubAcademicDraftRepository,
} from '@/domains/academics/academic.repository';
import type { GithubClient } from '@/github/github.types';

const request = {
  action: 'upsert',
  kind: 'course',
  id: 'co321',
  updatedBy: 'academic@pdn.ac.lk',
  recordPath: 'public/academic/v2/courses/co321.json',
  expectedRevision: 'old-course-blob',
  record: { id: 'co321', title: 'Software Engineering' },
} satisfies AcademicOperationRequest;

function dependencies() {
  const calls: Array<{ name: string; input: unknown }> = [];
  const client = {
    repos: {
      get: async () => ({ data: { default_branch: 'main' } }),
    },
    git: {
      getRef: async () => ({ data: { object: { sha: 'base-commit' } } }),
      createRef: async (input: unknown) => {
        calls.push({ name: 'git.createRef', input });
        return { data: {} };
      },
      getTree: async () => ({
        data: {
          sha: 'base-tree',
          truncated: false,
          tree: [
            {
              path: request.recordPath,
              type: 'blob',
              sha: 'old-course-blob',
            },
          ],
        },
      }),
      getBlob: async () => ({
        data: {
          content: Buffer.from('{}').toString('base64'),
          encoding: 'base64',
        },
      }),
      getCommit: async () => ({ data: { tree: { sha: 'base-tree' } } }),
      createBlob: async (input: unknown) => {
        calls.push({ name: 'git.createBlob', input });
        return { data: { sha: 'new-course-blob' } };
      },
      createTree: async (input: unknown) => {
        calls.push({ name: 'git.createTree', input });
        return { data: { sha: 'next-tree' } };
      },
      createCommit: async () => ({ data: { sha: 'next-commit' } }),
      updateRef: async () => ({
        data: { object: { sha: 'next-commit' } },
      }),
    },
    pulls: {
      list: async () => ({ data: [] }),
      create: async (input: { body: string; head: string }) => {
        calls.push({ name: 'pulls.create', input });
        return {
          data: {
            number: 21,
            html_url: 'https://github.test/pull/21',
            body: input.body,
            head: { ref: input.head, sha: 'next-commit' },
          },
        };
      },
    },
  } as unknown as GithubClient;
  const octokit = {
    issues: {
      addLabels: async () => ({ data: [] }),
    },
  } as unknown as Octokit;
  return { calls, client, octokit };
}

describe('academic repository', () => {
  test('commits only the authoritative academic record', async () => {
    const { calls, client, octokit } = dependencies();
    const repository = new GithubAcademicDraftRepository(client, octokit, {
      owner: 'scs',
      repo: 'academic',
    });

    const result = await repository.saveDraft(request, {
      operationId: 'op_12345678901234567890',
    });

    expect(result).toEqual({
      revision: 'new-course-blob',
      pullRequest: { number: 21, url: 'https://github.test/pull/21' },
    });
    const tree = calls.find((call) => call.name === 'git.createTree')!
      .input as { tree: Array<{ path: string }> };
    expect(tree.tree.map((entry) => entry.path)).toEqual([request.recordPath]);
    const pull = calls.find((call) => call.name === 'pulls.create')!.input as {
      body: string;
    };
    expect(pull.body).toContain('resourceType: course');
    expect(pull.body).toContain(`authoritativeFile: ${request.recordPath}`);
  });

  test('rejects a stale academic record revision before writing', async () => {
    const { calls, client, octokit } = dependencies();
    const repository = new GithubAcademicDraftRepository(client, octokit, {
      owner: 'scs',
      repo: 'academic',
    });

    expect(
      repository.saveDraft(
        { ...request, expectedRevision: 'stale-course-blob' },
        { operationId: 'op_12345678901234567890' }
      )
    ).rejects.toEqual(
      new AcademicRevisionConflictError('stale-course-blob', 'old-course-blob')
    );
    expect(calls.some((call) => call.name === 'git.createBlob')).toBeFalse();
  });
});
