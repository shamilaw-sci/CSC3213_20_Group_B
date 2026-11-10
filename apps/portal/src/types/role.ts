import {
  ACCESS_LEVEL,
  type AccessLevel,
  AccessLevelSchema,
  APP_ROLE,
  type AppRole,
  AppRoleSchema,
} from '@scs/schemas';

export const ROLE_LABEL: Record<AppRole, string> = {
  [APP_ROLE.USER]: 'User',
  [APP_ROLE.OTHER]: 'Other',
  [APP_ROLE.STUDENT]: 'Student',
  [APP_ROLE.ACADEMIC]: 'Academic',
  [APP_ROLE.NON_ACADEMIC]: 'Non-Academic',
  [APP_ROLE.ACADEMIC_SUPPORT]: 'Academic Support',
};

export const ACCESS_LEVEL_LABEL: Record<AccessLevel, string> = {
  [ACCESS_LEVEL.NONE]: 'None',
  [ACCESS_LEVEL.ADMIN]: 'Admin',
  [ACCESS_LEVEL.SUPER_ADMIN]: 'Super Admin',
};

function normalizeAppRole(value: unknown): AppRole | null {
  const parsed = AppRoleSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function normalizeAccessLevel(value: unknown): AccessLevel | null {
  const parsed = AccessLevelSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function getUserRole(user: { role: unknown }): AppRole {
  return normalizeAppRole(user.role) ?? APP_ROLE.USER;
}

export function getUserAccessLevel(user: {
  accessLevel?: unknown;
}): AccessLevel {
  return normalizeAccessLevel(user.accessLevel) ?? ACCESS_LEVEL.NONE;
}

export function isSuperAdminRole(user: { accessLevel?: unknown }): boolean {
  return getUserAccessLevel(user) === ACCESS_LEVEL.SUPER_ADMIN;
}

function isAdminRole(user: { accessLevel?: unknown }): boolean {
  const accessLevel = getUserAccessLevel(user);
  return (
    accessLevel === ACCESS_LEVEL.ADMIN ||
    accessLevel === ACCESS_LEVEL.SUPER_ADMIN
  );
}

export function canEditCoursesRole(user: {
  accessLevel?: unknown;
  role?: unknown;
}): boolean {
  return (
    isAdminRole(user) || getUserRole({ role: user.role }) === APP_ROLE.ACADEMIC
  );
}
