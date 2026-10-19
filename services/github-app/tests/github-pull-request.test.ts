import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import * as clientConfig from '@/config/client.config';
import {
  parseRuntimeConfig,
  runWithRuntimeConfig,
} from '@/config/runtime.config';
import { applyConfigFileChangeThroughPullRequest } from '@/integrations/github-pull-request';

const runtimeConfig = parseRuntimeConfig({
  GITHUB_APP_ID: '123',
  GITHUB_PRIVATE_KEY: 'private-key',
  GITHUB_INSTALLATION_ID: '456',
  GITHUB_OWNER: 'scs-pdn',
  GITHUB_CONFIG_REPOSITORY: 'config.scs.pdn.ac.lk',
  GITHUB_PEOPLE_DATA_REPOSITORY: 'data.scs.pdn.ac.lk',
  GITHUB_PROJECTS_DATA_REPOSITORY: 'data.scs.pdn.ac.lk',
  X_INTERNAL_SECRET: 'internal-secret',
  PORT: '3000',
});

let restore: (() => void) | undefined;

afterEach(() => restore?.());

describe('config-file pull request integration', () => {
  test('publishes a file through one commit and a non-force ref update', async () => {
    const calls: string[] = [];
    let updateRefInput: { force?: boolean } | undefined;
    const octokit = {
      repos: {
        get: async () => {
          calls.push('repos.get');
          return { data: { default_branch: 'main' } };
        },
      },
      git: {
        getRef: async () => {
          calls.push('git.getRef');
          return { data: { object: { sha: 'base-commit' } } };
        },
        createRef: async () => {
          calls.push('git.createRef');
          return { data: {} };
        },
        getCommit: async () => {
          calls.push('git.getCommit');
          return { data: { tree: { sha: 'base-tree' } } };
        },
        createBlob: async () => {
          calls.push('git.createBlob');
          return { data: { sha: 'blob-sha' } };
        },
        createTree: async () => {
          calls.push('git.createTree');
          return { data: { sha: 'next-tree' } };
        },
        createCommit: async () => {
          calls.push('git.createCommit');
          return { data: { sha: 'next-commit' } };
        },
        updateRef: async (input: { force?: boolean }) => {
          calls.push('git.updateRef');
          updateRefInput = input;
          return { data: { object: { sha: 'next-commit' } } };
        },
        deleteRef: async () => {
          calls.push('git.deleteRef');
          return { data: {} };
        },
      },
      pulls: {
        create: async ({ body, head }: { body: string; head: string }) => {
          calls.push('pulls.create');
          return {
            data: {
              number: 17,
              html_url: 'https://github.test/pulls/17',
              body,
              head: { ref: head, sha: 'next-commit' },
            },
          };
        },
        merge: async () => {
          calls.push('pulls.merge');
          return { data: { merged: true } };
        },
      },
    };
    const getOctokitSpy = spyOn(clientConfig, 'getOctokit').mockReturnValue(
      octokit as never
    );
    restore = () => getOctokitSpy.mockRestore();

    const result = await runWithRuntimeConfig(runtimeConfig, () =>
      applyConfigFileChangeThroughPullRequest({
        path: 'public/config/v1/person.json',
        content: '{"active":true}\n',
        message: 'Update access',
        pullRequestTitle: 'Update access',
        pullRequestBody: 'Automated update',
        branchNamePrefix: 'automation/access/person',
      })
    );

    expect(result.commitSha).toBe('next-commit');
    expect(result.pullRequest).toEqual({
      number: 17,
      url: 'https://github.test/pulls/17',
      merged: true,
    });
    expect(calls.filter((call) => call === 'git.createTree')).toHaveLength(1);
    expect(calls.filter((call) => call === 'git.createCommit')).toHaveLength(1);
    expect(updateRefInput?.force).toBeFalse();
    expect(calls.at(-1)).toBe('git.deleteRef');
  });
});
