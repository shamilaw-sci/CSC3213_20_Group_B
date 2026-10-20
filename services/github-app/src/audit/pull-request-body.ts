import type {
  RepositoryPermission,
  RepositoryPermissionLevel,
} from '@/schemas/user-access.schema';

function formatOptionalValue(value: string | undefined): string {
  return value && value.length > 0 ? value : 'none';
}

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
