import { buildRepositoryPermissionPullRequestBody } from '@/audit/pull-request-body';
import { getOctokit } from '@/config/client.config';
import envConfig from '@/config/env.config';
import {
  applyConfigFileChangeThroughPullRequest,
  type PullRequestAutomationResult,
} from '@/integrations/github-pull-request';
import {
  type RepositoryPermission,
  type RepositoryPermissionLevel,
  type UserAccessConfig,
  userAccessConfigSchema,
} from '@/schemas/user-access.schema';
import { isGitHubNotFoundError } from '@/utils/github';

function sortRepoPermissions(
  permissions: UserAccessConfig['permissions']['repo']
): UserAccessConfig['permissions']['repo'] {
  return Object.fromEntries(
    Object.entries(permissions).sort(([first], [second]) =>
      first.localeCompare(second)
    )
  );
}

function defaultUserAccessConfig(): UserAccessConfig {
  return { permissions: { repo: {} } };
}

function parseUserAccessConfig(value: string): UserAccessConfig {
  const config = userAccessConfigSchema.parse(JSON.parse(value));
  return {
    permissions: { repo: sortRepoPermissions(config.permissions.repo) },
  };
}

async function readUserAccessConfig(
  username: string
): Promise<UserAccessConfig | null> {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_CONFIG_REPOSITORY;
  const path = `public/config/v1/${username.trim().toLowerCase()}.json`;

  try {
    const response = await octokit.repos.getContent({ owner, repo, path });
    if (!Array.isArray(response.data) && 'content' in response.data) {
      return parseUserAccessConfig(
        Buffer.from(response.data.content, 'base64').toString('utf-8')
      );
    }
    return null;
  } catch (error) {
    if (isGitHubNotFoundError(error)) return null;
    throw error;
  }
}

export async function updateRepositoryPermission(input: {
  username: string;
  repository: string;
  permission: RepositoryPermissionLevel;
  active: boolean;
  updatedBy: string;
}): Promise<PullRequestAutomationResult> {
  const path = `public/config/v1/${input.username.toLowerCase()}.json`;
  const config =
    (await readUserAccessConfig(input.username)) ?? defaultUserAccessConfig();
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
    permissions: { repo: sortRepoPermissions(repositoryPermissions) },
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
