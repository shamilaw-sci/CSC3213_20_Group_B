import { Buffer } from 'node:buffer';

import { describe, expect, test } from 'bun:test';
import type { Octokit } from '@octokit/rest';

import type { ProjectOperationRequest } from '@/domains/projects/project.operation';
import {
  GithubProjectDraftRepository,
  ProjectRevisionConflictError,
} from '@/domains/projects/project.repository';
import type { GithubClient } from '@/github/github.types';

const request = {
  action: 'upsert',
  slug: 'example-project',
  updatedBy: 'owner@pdn.ac.lk',
  projectPath: 'public/projects/v2/projects/example-project.json',
  expectedRevision: 'old-project-blob',
  project: { id: 'project-1', slug: 'example-project', title: 'Example' },
} satisfies ProjectOperationRequest;

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
      getRef: async (input: unknown) => {
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
                path: request.projectPath,
                type: 'blob',
                sha: 'old-project-blob',
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
        return { data: { sha: 'new-project-blob' } };
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
            number: 12,
            html_url: 'https://github.test/pull/12',
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

describe('project repository', () => {
  test('commits only the authoritative project file', async () => {
    const { calls, client, octokit } = dependencies();
    const repository = new GithubProjectDraftRepository(client, octokit, {
      owner: 'scs',
      repo: 'projects',
    });

    const result = await repository.saveDraft(request, {
      operationId: 'op_12345678901234567890',
    });

    expect(result).toEqual({
      revision: 'new-project-blob',
      pullRequest: { number: 12, url: 'https://github.test/pull/12' },
    });
    const tree = calls.find((call) => call.name === 'git.createTree')!
      .input as { tree: Array<{ path: string }> };
    expect(tree.tree.map((entry) => entry.path)).toEqual([request.projectPath]);
    const pull = calls.find((call) => call.name === 'pulls.create')!.input as {
      body: string;
    };
    expect(pull.body).toContain('resourceType: project');
    expect(pull.body).toContain(`authoritativeFile: ${request.projectPath}`);
  });

  test('rejects a stale authoritative project revision before writing', async () => {
    const { calls, client, octokit } = dependencies();
    const repository = new GithubProjectDraftRepository(client, octokit, {
      owner: 'scs',
      repo: 'projects',
    });

    expect(
      repository.saveDraft(
        { ...request, expectedRevision: 'stale-project-blob' },
        { operationId: 'op_12345678901234567890' }
      )
    ).rejects.toEqual(
      new ProjectRevisionConflictError('stale-project-blob', 'old-project-blob')
    );
    expect(calls.some((call) => call.name === 'git.createBlob')).toBeFalse();
  });
});
