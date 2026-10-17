import type {
  RepositoryPermission,
  RepositoryPermissionLevel,
  UserAccessConfig,
} from '@/schemas/user-access.schema';

/**
 * Formats optional values for human-readable PR audit bodies.
 */
function formatOptionalValue(value: string | undefined): string {
  return value && value.length > 0 ? value : 'none';
}

/**
 * Builds the PR audit body for a proxy settings update.
 */
export function buildProxySettingsPullRequestBody(input: {
  username: string;
  updatedBy: string;
  updatedAt: string;
  path: string;
  previousProxy: UserAccessConfig['proxy'];
  nextProxy: UserAccessConfig['proxy'];
}): string {
  return [
    `Triggered by: ${input.updatedBy}`,
    `Changed by: ${input.updatedBy}`,
    `Changed for user: ${input.username}`,
    `Changed at: ${input.updatedAt}`,
    `Config file: ${input.path}`,
    '',
    'Change type: proxy settings',
    '',
    'Before:',
    `- proxy.active: ${input.previousProxy.active}`,
    `- proxy.url: ${formatOptionalValue(input.previousProxy.url)}`,
    `- proxy.availableAttempts: ${input.previousProxy.availableAttempts}`,
    `- proxy.updatedAt: ${formatOptionalValue(input.previousProxy.updatedAt)}`,
    `- proxy.updatedBy: ${formatOptionalValue(input.previousProxy.updatedBy)}`,
    '',
    'After:',
    `- proxy.active: ${input.nextProxy.active}`,
    `- proxy.url: ${formatOptionalValue(input.nextProxy.url)}`,
    `- proxy.availableAttempts: ${input.nextProxy.availableAttempts}`,
    `- proxy.updatedAt: ${formatOptionalValue(input.nextProxy.updatedAt)}`,
    `- proxy.updatedBy: ${formatOptionalValue(input.nextProxy.updatedBy)}`,
  ].join('\n');
}

/**
 * Builds the PR audit body for a repository permission update.
 */
export function buildRepositoryPermissionPullRequestBody(input: {
  username: string;
  repository: string;
  permission: RepositoryPermissionLevel;
  active: boolean;
  updatedBy: string;
  updatedAt: string;
  path: string;
  previousPermission: RepositoryPermission | undefined;
  nextPermission: RepositoryPermission | undefined;
}): string {
  const action = input.active ? 'grant' : 'remove';

  return [
    `Triggered by: ${input.updatedBy}`,
    `Changed by: ${input.updatedBy}`,
    `Changed for user: ${input.username}`,
    `Changed at: ${input.updatedAt}`,
    `Config file: ${input.path}`,
    '',
    'Change type: repository permission',
    `Action: ${action}`,
    `Repository: ${input.repository}`,
    `Requested permission: ${input.permission}`,
    '',
    'Before:',
    `- permission: ${formatOptionalValue(input.previousPermission?.permission)}`,
    `- updatedAt: ${formatOptionalValue(input.previousPermission?.updatedAt)}`,
    `- updatedBy: ${formatOptionalValue(input.previousPermission?.updatedBy)}`,
    '',
    'After:',
    `- permission: ${formatOptionalValue(input.nextPermission?.permission)}`,
    `- updatedAt: ${formatOptionalValue(input.nextPermission?.updatedAt)}`,
    `- updatedBy: ${formatOptionalValue(input.nextPermission?.updatedBy)}`,
  ].join('\n');
}
