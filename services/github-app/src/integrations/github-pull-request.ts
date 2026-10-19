import { randomUUID } from 'node:crypto';

import { getOctokit } from '@/config/client.config';
import envConfig from '@/config/env.config';
import { createAtomicCommit } from '@/github/atomic-commit';
import { createGithubClient } from '@/github/github.client';
import { PullRequestGateway } from '@/github/pull-request.gateway';
import { RepositoryGateway } from '@/github/repository.gateway';

/**
 * Result returned after a config file change is committed through a PR.
 */
export interface PullRequestAutomationResult {
  branch: string;
  commitSha: string;
  pullRequest: {
    number: number;
    url: string;
    merged: boolean;
  };
}

interface ConfigFileChangeInput {
  path: string;
  content: string;
  message: string;
  pullRequestTitle: string;
  pullRequestBody: string;
  branchNamePrefix: string;
}

/**
 * Creates a unique branch name under the requested automation prefix.
 */
function createBranchName(prefix: string): string {
  const timestamp = new Date()
    .toISOString()
    .replaceAll(/[:.]/g, '-')
    .toLowerCase();
  const randomSuffix = randomUUID().slice(0, 8);
  const normalizedPrefix = prefix
    .toLowerCase()
    .replaceAll(/[^a-z0-9/_-]/g, '-')
    .replaceAll(/-+/g, '-')
    .replace(/^\/+|\/+$/g, '');

  return `${normalizedPrefix}/${timestamp}-${randomSuffix}`;
}

/**
 * Applies a single config file change by creating, opening, merging, and
 * cleaning up an automation pull request.
 */
export async function applyConfigFileChangeThroughPullRequest(
  input: ConfigFileChangeInput
): Promise<PullRequestAutomationResult> {
  const client = createGithubClient(getOctokit());
  const repository = {
    owner: envConfig.GITHUB_OWNER,
    repo: envConfig.GITHUB_CONFIG_REPOSITORY,
  };
  const repositoryGateway = new RepositoryGateway(client, repository);
  const pullRequestGateway = new PullRequestGateway(client, repository);
  const defaultBranch = await repositoryGateway.getDefaultBranch();

  const branch = createBranchName(input.branchNamePrefix);

  await repositoryGateway.createBranch(branch, defaultBranch.sha);
  const commit = await createAtomicCommit(client, {
    repository,
    ref: `heads/${branch}`,
    expectedParentSha: defaultBranch.sha,
    message: input.message,
    changes: [{ path: input.path, content: input.content }],
  });

  const pullRequest = await pullRequestGateway.create({
    title: input.pullRequestTitle,
    body: input.pullRequestBody,
    head: branch,
    base: defaultBranch.name,
  });

  const merged = await pullRequestGateway.merge(pullRequest.number);

  try {
    await repositoryGateway.deleteBranch(branch);
  } catch (error) {
    console.warn(`Failed to delete branch ${branch}:`, error);
  }

  return {
    branch,
    commitSha: commit.commitSha,
    pullRequest: {
      number: pullRequest.number,
      url: pullRequest.html_url,
      merged,
    },
  };
}
