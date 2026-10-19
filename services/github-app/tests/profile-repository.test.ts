import { Buffer } from 'node:buffer';

import { describe, expect, test } from 'bun:test';
import type { Octokit } from '@octokit/rest';

import {
  GithubProfileDraftRepository,
  ProfileRevisionConflictError,
} from '@/domains/profiles/profile.repository';
import type { ProfileDraftRequest } from '@/domains/profiles/profile.types';
import type { GithubClient } from '@/github/github.types';

const request = {
  username: 's21513',
  updatedBy: 'student@pdn.ac.lk',
  profileKind: 'student',
  userPath: 'public/people/v2/users/s21513.json',
  aggregatePaths: ['public/people/v2/students/s21.json'],
  expectedRevision: 'old-user-blob',
  profile: {
    title: 'Ms',
    fullName: 'Jane Student',
    registrationNo: 'S21513',
    studentType: 'UNDERGRADUATE',
    studentTrack: 'GENERAL',
    level: '3000',
    status: 'CURRENT',
  },
} satisfies ProfileDraftRequest;

function dependencies() {
  const calls: Array<{ name: string; input: unknown }> = [];
  const client = {
    repos: {
      get: async (input: unknown) => {
        calls.push({ name: 'repos.get', input });
        return { data: { default_branch: 'main' } };
      },
    },
    git: {
      getRef: async (input: { ref: string }) => {
        calls.push({ name: 'git.getRef', input });
        return { data: { object: { sha: 'base-commit' } } };
      },
      createRef: async (input: unknown) => {
        calls.push({ name: 'git.createRef', input });
        return { data: {} };
      },
      getTree: async (input: unknown) => {
        calls.push({ name: 'git.getTree', input });
        return {
          data: {
            sha: 'base-tree',
            truncated: false,
            tree: [
              {
                path: request.userPath,
                type: 'blob',
                sha: 'old-user-blob',
              },
            ],
          },
        };
      },
      getBlob: async (input: unknown) => {
        calls.push({ name: 'git.getBlob', input });
        return {
          data: {
            content: Buffer.from('{}').toString('base64'),
            encoding: 'base64',
          },
        };
      },
      getCommit: async (input: unknown) => {
        calls.push({ name: 'git.getCommit', input });
        return { data: { tree: { sha: 'base-tree' } } };
      },
      createBlob: async (input: unknown) => {
        calls.push({ name: 'git.createBlob', input });
        return { data: { sha: 'new-user-blob' } };
      },
      createTree: async (input: unknown) => {
        calls.push({ name: 'git.createTree', input });
        return { data: { sha: 'next-tree' } };
      },
      createCommit: async (input: unknown) => {
        calls.push({ name: 'git.createCommit', input });
        return { data: { sha: 'next-commit' } };
      },
      updateRef: async (input: unknown) => {
        calls.push({ name: 'git.updateRef', input });
        return { data: { object: { sha: 'next-commit' } } };
      },
    },
    pulls: {
      list: async (input: unknown) => {
        calls.push({ name: 'pulls.list', input });
        return { data: [] };
      },
      create: async (input: { body: string; head: string }) => {
        calls.push({ name: 'pulls.create', input });
        return {
          data: {
            number: 42,
            html_url: 'https://github.test/pull/42',
            body: input.body,
            head: { ref: input.head, sha: 'next-commit' },
          },
        };
      },
    },
  } as unknown as GithubClient;
  const octokit = {
    issues: {
      addLabels: async (input: unknown) => {
        calls.push({ name: 'issues.addLabels', input });
        return { data: [] };
      },
    },
  } as unknown as Octokit;
  return { calls, client, octokit };
}

describe('profile repository', () => {
  test('commits only the authoritative profile with structured metadata', async () => {
    const { calls, client, octokit } = dependencies();
    const repository = new GithubProfileDraftRepository(client, octokit, {
      owner: 'scs',
      repo: 'data',
    });

    const result = await repository.saveDraft(request, {
      operationId: 'op_12345678901234567890',
    });

    expect(result).toEqual({
      revision: 'new-user-blob',
      pullRequest: { number: 42, url: 'https://github.test/pull/42' },
    });
    const tree = calls.find((call) => call.name === 'git.createTree')!
      .input as {
      tree: Array<{
        path: string;
        mode: string;
        type: string;
        sha: string;
      }>;
    };
    expect(tree.tree).toEqual([
      {
        path: request.userPath,
        mode: '100644',
        type: 'blob',
        sha: 'new-user-blob',
      },
    ]);
    const pull = calls.find((call) => call.name === 'pulls.create')!.input as {
      body: string;
    };
    expect(pull.body).toContain('operationId: op_12345678901234567890');
    expect(pull.body).toContain(`authoritativeFile: ${request.userPath}`);
  });

  test('reports the current user blob without writing on a stale revision', async () => {
    const { calls, client, octokit } = dependencies();
    const repository = new GithubProfileDraftRepository(client, octokit, {
      owner: 'scs',
      repo: 'data',
    });

    expect(
      repository.saveDraft(
        { ...request, expectedRevision: 'stale-user-blob' },
        { operationId: 'op_12345678901234567890' }
      )
    ).rejects.toEqual(
      new ProfileRevisionConflictError('stale-user-blob', 'old-user-blob')
    );
    expect(calls.some((call) => call.name === 'git.createBlob')).toBeFalse();
  });
});
