export const APP_ROLES = [
  'USER',
  'OTHER',
  'STUDENT',
  'ACADEMIC',
  'NON_ACADEMIC',
  'ACADEMIC_SUPPORT',
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const APP_ROLE = {
  USER: 'USER',
  OTHER: 'OTHER',
  STUDENT: 'STUDENT',
  ACADEMIC: 'ACADEMIC',
  NON_ACADEMIC: 'NON_ACADEMIC',
  ACADEMIC_SUPPORT: 'ACADEMIC_SUPPORT',
} as const satisfies Record<AppRole, AppRole>;

export const ACCESS_LEVELS = ['NONE', 'ADMIN', 'SUPER_ADMIN'] as const;

export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const ACCESS_LEVEL = {
  NONE: 'NONE',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const satisfies Record<AccessLevel, AccessLevel>;

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

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && APP_ROLES.includes(value as AppRole);
}

export function normalizeAppRole(value: unknown): AppRole | null {
  if (isAppRole(value)) return value;
  return null;
}

export function isAccessLevel(value: unknown): value is AccessLevel {
  return (
    typeof value === 'string' && ACCESS_LEVELS.includes(value as AccessLevel)
  );
}

export function normalizeAccessLevel(value: unknown): AccessLevel | null {
  if (isAccessLevel(value)) return value;
  return null;
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

export function isAdminRole(user: { accessLevel?: unknown }): boolean {
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
