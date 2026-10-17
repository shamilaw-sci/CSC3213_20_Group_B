import { getOctokit } from '@/config/client.config';
import envConfig from '@/config/env.config';
import {
  buildProxySettingsPullRequestBody,
  buildRepositoryPermissionPullRequestBody,
} from '@/audit/pull-request-body';
import {
  type RepositoryPermission,
  type RepositoryPermissionLevel,
  type AllProxyConfig,
  type UserAccessConfig,
  allProxyConfigSchema,
  userAccessConfigSchema,
} from '@/schemas/user-access.schema';
import {
  applyConfigFileChangeThroughPullRequest,
  type PullRequestAutomationResult,
} from '@/integrations/github-pull-request';
import { isGitHubNotFoundError } from '@/utils/github';

interface UserAccessConfigEntry {
  config: UserAccessConfig;
  ref?: string;
}

const PROXY_CONFIG_LABELS = ['config-update', 'auto-merge-config'];
const ALL_PROXY_CONFIG_PATH = 'public/config/v1/all.json';

/**
 * Returns repository permissions in stable key order for deterministic commits.
 */
function sortRepoPermissions(
  permissions: UserAccessConfig['permissions']['repo']
): UserAccessConfig['permissions']['repo'] {
  return Object.fromEntries(
    Object.entries(permissions).sort(([first], [second]) =>
      first.localeCompare(second)
    )
  );
}

/**
 * Creates a denied-by-default access config for new users.
 */
function createDefaultUserAccessConfig(): UserAccessConfig {
  return {
    proxy: {
      active: false,
      url: '',
      availableAttempts: 5,
    },
    permissions: {
      repo: {},
    },
  };
}

function createDefaultAllProxyConfig(): AllProxyConfig {
  return {
    schemaVersion: 1,
    generatedAt: null,
    users: {},
  };
}

/**
 * Parses stored user access JSON and rejects malformed config.
 */
function parseUserAccessConfig(value: string): UserAccessConfig {
  const config = userAccessConfigSchema.parse(JSON.parse(value));

  return {
    proxy: config.proxy,
    permissions: {
      repo: sortRepoPermissions(config.permissions.repo),
    },
  };
}

function parseAllProxyConfig(value: string): AllProxyConfig {
  const config = allProxyConfigSchema.parse(JSON.parse(value));

  return {
    schemaVersion: config.schemaVersion,
    generatedAt: config.generatedAt,
    users: Object.fromEntries(
      Object.entries(config.users).sort(([first], [second]) =>
        first.localeCompare(second)
      )
    ),
  };
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function encodeBase64(value: string): string {
  return Buffer.from(value).toString('base64');
}

function decodeBase64(value: string): string {
  return Buffer.from(value, 'base64').toString('utf-8');
}

function stringifyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function createProxyConfigBranchName(username: string): string {
  const timestamp = new Date()
    .toISOString()
    .replaceAll(/[:.]/g, '-')
    .toLowerCase();

  return `proxy-config/${normalizeUsername(username)}-${timestamp}`;
}

function proxyConfigPullRequestBody(input: {
  username: string;
  email: string;
  updatedBy: string;
  updatedAt: string;
  path: string;
  allPath: string;
  previousProxy: UserAccessConfig['proxy'];
  nextProxy: UserAccessConfig['proxy'];
}): string {
  return [
    '<!-- proxy-config-update',
    `username: ${normalizeUsername(input.username)}`,
    `email: ${input.email.toLowerCase()}`,
    `targetConfigFile: ${input.path}`,
    `targetAllConfigFile: ${input.allPath}`,
    '-->',
    '',
    buildProxySettingsPullRequestBody(input),
    '',
    'This PR is expected to be validated and auto-merged by GitHub Actions.',
  ].join('\n');
}

async function readConfigFile(
  username: string,
  ref?: string
): Promise<UserAccessConfigEntry | null> {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_CONFIG_REPOSITORY;
  const path = `public/config/v1/${normalizeUsername(username)}.json`;

  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ...(ref ? { ref } : {}),
    });

    if (!Array.isArray(response.data) && 'content' in response.data) {
      return {
        config: parseUserAccessConfig(decodeBase64(response.data.content)),
        ref,
      };
    }
    return null;
  } catch (error) {
    if (isGitHubNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

async function readAllProxyConfig(ref?: string): Promise<AllProxyConfig> {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_CONFIG_REPOSITORY;

  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path: ALL_PROXY_CONFIG_PATH,
      ...(ref ? { ref } : {}),
    });

    if (!Array.isArray(response.data) && 'content' in response.data) {
      return parseAllProxyConfig(decodeBase64(response.data.content));
    }
    return createDefaultAllProxyConfig();
  } catch (error) {
    if (isGitHubNotFoundError(error)) {
      return createDefaultAllProxyConfig();
    }

    throw error;
  }
}

async function findOpenProxyConfigPullRequest(username: string) {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_CONFIG_REPOSITORY;
  const normalized = normalizeUsername(username);
  const pulls = await octokit.pulls.list({
    owner,
    repo,
    state: 'open',
    per_page: 50,
    sort: 'updated',
    direction: 'desc',
  });

  return (
    pulls.data.find((pull) => {
      const body = pull.body ?? '';
      return (
        pull.head.ref.startsWith(`proxy-config/${normalized}`) ||
        body.includes(`username: ${normalized}`)
      );
    }) ?? null
  );
}

async function getDefaultBranchSha(): Promise<{
  defaultBranch: string;
  sha: string;
}> {
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

  return { defaultBranch, sha: baseRef.data.object.sha };
}

async function writeConfigFile(input: {
  path: string;
  branch: string;
  content: string;
  message: string;
}): Promise<string> {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_CONFIG_REPOSITORY;
  let existingSha: string | undefined;

  try {
    const existing = await octokit.repos.getContent({
      owner,
      repo,
      path: input.path,
      ref: input.branch,
    });

    if (!Array.isArray(existing.data) && 'sha' in existing.data) {
      existingSha = existing.data.sha;
    }
  } catch (error) {
    if (!isGitHubNotFoundError(error)) {
      throw error;
    }
  }

  const update = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: input.path,
    message: input.message,
    content: encodeBase64(input.content),
    branch: input.branch,
    sha: existingSha,
  });

  if (!update.data.commit.sha) {
    throw new Error(`GitHub did not return a commit SHA for ${input.path}`);
  }

  return update.data.commit.sha;
}

async function fetchUserAccessConfigEntry(
  username: string
): Promise<UserAccessConfigEntry | null> {
  const openPull = await findOpenProxyConfigPullRequest(username);
  if (openPull) {
    const draft = await readConfigFile(username, openPull.head.ref);
    if (draft) {
      return draft;
    }
  }

  return await readConfigFile(username);
}

/**
 * Reads a user's access config from the configured GitHub repository.
 */
export async function getUserAccessConfig(
  username: string
): Promise<UserAccessConfig | null> {
  const entry = await fetchUserAccessConfigEntry(username);
  return entry?.config ?? null;
}

/**
 * Updates a user's proxy settings through an auto-created pull request.
 */
export async function updateUserProxySettings(
  username: string,
  email: string,
  updatedBy: string,
  patch: { active: boolean; url: string; availableAttempts: number }
): Promise<PullRequestAutomationResult> {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_CONFIG_REPOSITORY;
  const normalizedUsername = normalizeUsername(username);
  const normalizedEmail = email.trim().toLowerCase();
  const path = `public/config/v1/${normalizedUsername}.json`;

  const existing = await fetchUserAccessConfigEntry(username);
  const existingConfig = existing?.config ?? createDefaultUserAccessConfig();
  const updatedAt = new Date().toISOString();
  const existingPull = await findOpenProxyConfigPullRequest(normalizedUsername);
  let branch = existingPull?.head.ref;
  let defaultBranch = '';

  const config: UserAccessConfig = {
    proxy: {
      active: patch.active,
      url: patch.url,
      availableAttempts: patch.availableAttempts,
      updatedAt,
      updatedBy,
    },
    permissions: existingConfig.permissions,
  };

  if (!branch) {
    const defaultRef = await getDefaultBranchSha();
    defaultBranch = defaultRef.defaultBranch;
    branch = createProxyConfigBranchName(normalizedUsername);
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha: defaultRef.sha,
    });
  }

  const pullRequestBody = proxyConfigPullRequestBody({
    username,
    email: normalizedEmail,
    updatedBy,
    updatedAt,
    path,
    allPath: ALL_PROXY_CONFIG_PATH,
    previousProxy: existingConfig.proxy,
    nextProxy: config.proxy,
  });
  await writeConfigFile({
    path,
    branch,
    message: `Update proxy config for ${normalizedUsername}`,
    content: stringifyJson(config),
  });
  const existingAllConfig = await readAllProxyConfig(branch);
  const allConfig: AllProxyConfig = {
    schemaVersion: 1,
    generatedAt: updatedAt,
    users: Object.fromEntries(
      Object.entries({
        ...existingAllConfig.users,
        [normalizedEmail]: {
          username: normalizedUsername,
          proxy: config.proxy,
        },
      }).sort(([first], [second]) => first.localeCompare(second))
    ),
  };
  const commitSha = await writeConfigFile({
    path: ALL_PROXY_CONFIG_PATH,
    branch,
    message: `Reconcile proxy index for ${normalizedUsername}`,
    content: stringifyJson(allConfig),
  });

  let pullRequestNumber = existingPull?.number;
  let pullRequestUrl = existingPull?.html_url;
  if (existingPull) {
    await octokit.pulls.update({
      owner,
      repo,
      pull_number: existingPull.number,
      body: pullRequestBody,
    });
  } else {
    const createdPullRequest = await octokit.pulls.create({
      owner,
      repo,
      title: `Update proxy config for ${normalizedUsername}`,
      body: pullRequestBody,
      head: branch,
      base: defaultBranch,
    });
    pullRequestNumber = createdPullRequest.data.number;
    pullRequestUrl = createdPullRequest.data.html_url;

    for (const label of PROXY_CONFIG_LABELS) {
      try {
        await octokit.issues.addLabels({
          owner,
          repo,
          issue_number: pullRequestNumber,
          labels: [label],
        });
      } catch (error) {
        console.warn(`Failed to add label ${label}:`, error);
      }
    }
  }

  if (!pullRequestNumber || !pullRequestUrl) {
    throw new Error(`GitHub did not return a pull request for ${path}`);
  }

  return {
    branch,
    commitSha,
    pullRequest: {
      number: pullRequestNumber,
      url: pullRequestUrl,
      merged: false,
    },
  };
}

/**
 * Grants or removes one repository permission through an auto-created PR.
 */
export async function updateRepositoryPermission(input: {
  username: string;
  repository: string;
  permission: RepositoryPermissionLevel;
  active: boolean;
  updatedBy: string;
}): Promise<PullRequestAutomationResult> {
  const path = `public/config/v1/${input.username.toLowerCase()}.json`;
  const existing = await fetchUserAccessConfigEntry(input.username);
  const config = existing?.config ?? createDefaultUserAccessConfig();
  const repositoryPermissions = { ...config.permissions.repo };
  const updatedAt = new Date().toISOString();
  const previousPermission = repositoryPermissions[input.repository];
  let nextPermission: RepositoryPermission | undefined;

  if (input.active) {
    nextPermission = {
      permission: input.permission,
      updatedAt,
      updatedBy: input.updatedBy,
    };
    repositoryPermissions[input.repository] = nextPermission;
  } else {
    delete repositoryPermissions[input.repository];
  }

  const updatedConfig: UserAccessConfig = {
    proxy: config.proxy,
    permissions: {
      repo: sortRepoPermissions(repositoryPermissions),
    },
  };

  const action = input.active ? 'Grant' : 'Remove';
  const pullRequestBody = buildRepositoryPermissionPullRequestBody({
    username: input.username,
    repository: input.repository,
    permission: input.permission,
    active: input.active,
    updatedBy: input.updatedBy,
    updatedAt,
    path,
    previousPermission,
    nextPermission,
  });

  return await applyConfigFileChangeThroughPullRequest({
    path,
    message: `${action} ${input.repository} access for ${input.username}`,
    content: `${JSON.stringify(updatedConfig, null, 2)}\n`,
    pullRequestTitle: `${action} ${input.repository} access for ${input.username}`,
    pullRequestBody,
    branchNamePrefix: `automation/repository-permission/${input.username}/${input.repository}`,
  });
}
