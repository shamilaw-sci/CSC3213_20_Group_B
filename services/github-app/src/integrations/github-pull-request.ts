import { randomUUID } from 'node:crypto';

import { getOctokit } from '@/config/client.config';
import envConfig from '@/config/env.config';
import { isGitHubNotFoundError } from '@/utils/github';

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

interface ExistingContent {
  sha?: string;
}

/**
 * Encodes file content for GitHub's create-or-update-file API.
 */
function encodeBase64(value: string): string {
  return Buffer.from(value).toString('base64');
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
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_CONFIG_REPOSITORY;

  const repository = await octokit.repos.get({ owner, repo });
  const defaultBranch = repository.data.default_branch;
  const baseRef = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${defaultBranch}`,
  });

  const branch = createBranchName(input.branchNamePrefix);

  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branch}`,
    sha: baseRef.data.object.sha,
  });

  let existingContent: ExistingContent | undefined;
  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path: input.path,
      ref: branch,
    });

    if (!Array.isArray(response.data) && 'sha' in response.data) {
      existingContent = { sha: response.data.sha };
    }
  } catch (error) {
    if (!isGitHubNotFoundError(error)) {
      throw error;
    }
  }

  const fileUpdate = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: input.path,
    message: input.message,
    content: encodeBase64(input.content),
    branch,
    sha: existingContent?.sha,
  });

  const pullRequest = await octokit.pulls.create({
    owner,
    repo,
    title: input.pullRequestTitle,
    body: input.pullRequestBody,
    head: branch,
    base: defaultBranch,
  });

  const merge = await octokit.pulls.merge({
    owner,
    repo,
    pull_number: pullRequest.data.number,
    merge_method: 'squash',
  });
  const commitSha = fileUpdate.data.commit.sha;

  if (!commitSha) {
    throw new Error(`GitHub did not return a commit SHA for ${input.path}`);
  }

  try {
    await octokit.git.deleteRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
  } catch (error) {
    console.warn(`Failed to delete branch ${branch}:`, error);
  }

  return {
    branch,
    commitSha,
    pullRequest: {
      number: pullRequest.data.number,
      url: pullRequest.data.html_url,
      merged: merge.data.merged,
    },
  };
}
