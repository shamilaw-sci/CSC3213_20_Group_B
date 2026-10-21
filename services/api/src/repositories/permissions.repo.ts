import type { Env } from '@/types/env';

type RepoRole = 'ADMIN' | 'EDITOR' | 'VIEWER';

const APP_ROLES = [
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

const ACCESS_LEVELS = ['NONE', 'ADMIN', 'SUPER_ADMIN'] as const;

export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const ACCESS_LEVEL = {
  NONE: 'NONE',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const satisfies Record<AccessLevel, AccessLevel>;

const PROFILE_PICTURE_MODES = [
  'google',
  'github',
  'manual',
  'gravatar',
] as const;

export type ProfilePictureMode = (typeof PROFILE_PICTURE_MODES)[number];

/**
 * Stored in API D1. `role` identifies the person category; `accessLevel` is an
 * independent management grant and must not be inferred from that role.
 */
export interface Permission {
  role: AppRole;
  accessLevel?: AccessLevel;
  include?: Record<string, RepoRole>;
  exclude?: string[];
  blacklisted?: boolean;
  notifications?: {
    email?: boolean;
    push?: boolean;
  };
  name?: string;
  picture?: string;
  pictureMode?: ProfilePictureMode;
  gravatarMail?: string;
  /** Unix epoch milliseconds when the user was first registered. */
  createdAt?: number;
}

export interface UserData {
  id: string;
  email: string;
  name: string;
  picture: string;
  role: AppRole;
  accessLevel: AccessLevel;
  blacklisted: boolean;
  createdAt?: number;
}

export interface UserDataPage {
  users: UserData[];
  nextCursor: string | null;
}

function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && APP_ROLES.includes(value as AppRole);
}

export function normalizeAppRole(value: unknown): AppRole | null {
  if (isAppRole(value)) return value;
  return null;
}

function isAccessLevel(value: unknown): value is AccessLevel {
  return (
    typeof value === 'string' && ACCESS_LEVELS.includes(value as AccessLevel)
  );
}

export function normalizeAccessLevel(value: unknown): AccessLevel | null {
  if (isAccessLevel(value)) return value;
  return null;
}

export function isProfilePictureMode(
  value: unknown
): value is ProfilePictureMode {
  return (
    typeof value === 'string' &&
    PROFILE_PICTURE_MODES.includes(value as ProfilePictureMode)
  );
}

export function getPermissionRole(permission?: Permission | null): AppRole {
  return normalizeAppRole(permission?.role) ?? APP_ROLE.USER;
}

export function getPermissionAccessLevel(
  permission?: Permission | null
): AccessLevel {
  return normalizeAccessLevel(permission?.accessLevel) ?? ACCESS_LEVEL.NONE;
}

export function defaultRoleForEmail(email: string): AppRole {
  const username = email.toLowerCase().split('@')[0] ?? '';
  if (/^s\d{5}$/.test(username) || /^s\d{2}sp\d{3}$/.test(username)) {
    return APP_ROLE.STUDENT;
  }

  return APP_ROLE.ACADEMIC;
}

export function isSuperAdmin(permission?: Permission | null): boolean {
  return getPermissionAccessLevel(permission) === ACCESS_LEVEL.SUPER_ADMIN;
}

export function isUserRole(permission?: Permission | null): boolean {
  return (
    getPermissionRole(permission) === APP_ROLE.USER &&
    getPermissionAccessLevel(permission) === ACCESS_LEVEL.NONE
  );
}

export function normalizePermissionPatch(
  patch: Partial<Permission>
): Partial<Permission> {
  const normalized: Partial<Permission> = {};

  if ('role' in patch) {
    const normalizedRole = normalizeAppRole(patch.role);
    if (!normalizedRole) {
      throw new Error('Invalid role');
    }

    normalized.role = normalizedRole;
  }

  if ('accessLevel' in patch) {
    const accessLevel = normalizeAccessLevel(patch.accessLevel);
    if (!accessLevel) {
      throw new Error('Invalid accessLevel');
    }

    normalized.accessLevel = accessLevel;
  }

  if ('include' in patch) normalized.include = patch.include;
  if ('exclude' in patch) normalized.exclude = patch.exclude;
  if ('blacklisted' in patch) normalized.blacklisted = patch.blacklisted;
  if ('notifications' in patch) normalized.notifications = patch.notifications;
  if ('name' in patch) normalized.name = patch.name;
  if ('picture' in patch) normalized.picture = patch.picture;
  if ('pictureMode' in patch) {
    if (!isProfilePictureMode(patch.pictureMode)) {
      throw new Error('Invalid pictureMode');
    }

    normalized.pictureMode = patch.pictureMode;
  }
  if ('gravatarMail' in patch) normalized.gravatarMail = patch.gravatarMail;
  if ('createdAt' in patch) normalized.createdAt = patch.createdAt;

  return normalized;
}

function sanitizePermission(permission: Permission): Permission {
  const sanitized: Permission = {
    role: getPermissionRole(permission),
    accessLevel: getPermissionAccessLevel(permission),
  };

  if ('include' in permission) sanitized.include = permission.include;
  if ('exclude' in permission) sanitized.exclude = permission.exclude;
  if ('blacklisted' in permission)
    sanitized.blacklisted = permission.blacklisted;
  if ('notifications' in permission) {
    sanitized.notifications = permission.notifications;
  }
  if ('name' in permission) sanitized.name = permission.name;
  if ('picture' in permission) sanitized.picture = permission.picture;
  if (isProfilePictureMode(permission.pictureMode)) {
    sanitized.pictureMode = permission.pictureMode;
  }
  if ('gravatarMail' in permission)
    sanitized.gravatarMail = permission.gravatarMail;
  if ('createdAt' in permission) sanitized.createdAt = permission.createdAt;

  return sanitized;
}

function permissionUserData(email: string, permission: Permission): UserData {
  return {
    id: email,
    email,
    name: permission.name ?? '',
    picture: permission.picture ?? '',
    role: getPermissionRole(permission),
    accessLevel: getPermissionAccessLevel(permission),
    blacklisted: permission.blacklisted ?? false,
    createdAt: permission.createdAt,
  };
}

export async function hasOtherSuperAdmin(
  email: string,
  env: Env
): Promise<boolean> {
  const result = await env.AUTH_DB.prepare(
    'SELECT 1 AS present FROM permission WHERE accessLevel = ? AND email <> ? LIMIT 1'
  )
    .bind(ACCESS_LEVEL.SUPER_ADMIN, email.toLowerCase())
    .first<{ present: number }>();
  return result !== null;
}

export async function getUserPermission(
  email: string,
  env: Env
): Promise<Permission | null> {
  const sanitizedEmail = email.toLowerCase();
  const row = await env.AUTH_DB.prepare(
    'SELECT permissionJson FROM permission WHERE email = ? LIMIT 1'
  )
    .bind(sanitizedEmail)
    .first<{ permissionJson: string }>();
  if (!row) return null;

  try {
    return sanitizePermission(JSON.parse(row.permissionJson) as Permission);
  } catch {
    return null;
  }
}

export async function setUserPermission(
  email: string,
  permission: Permission,
  env: Env
): Promise<void> {
  const sanitizedEmail = email.toLowerCase();
  const sanitizedPermission = sanitizePermission(permission);
  const user = permissionUserData(sanitizedEmail, sanitizedPermission);
  await env.AUTH_DB.prepare(
    `INSERT INTO permission (
      email, permissionJson, role, accessLevel, name, picture, blacklisted, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET
      permissionJson = excluded.permissionJson,
      role = excluded.role,
      accessLevel = excluded.accessLevel,
      name = excluded.name,
      picture = excluded.picture,
      blacklisted = excluded.blacklisted,
      createdAt = excluded.createdAt`
  )
    .bind(
      sanitizedEmail,
      JSON.stringify(sanitizedPermission),
      user.role,
      user.accessLevel,
      user.name,
      user.picture,
      user.blacklisted ? 1 : 0,
      user.createdAt ?? null
    )
    .run();
}

export async function deleteUserPermission(
  email: string,
  env: Env
): Promise<void> {
  const sanitizedEmail = email.toLowerCase();
  await env.AUTH_DB.prepare('DELETE FROM permission WHERE email = ?')
    .bind(sanitizedEmail)
    .run();
}

export async function setNotificationPreferences(
  email: string,
  notifications: { email: boolean; push: boolean },
  env: Env
): Promise<void> {
  const permission = await getUserPermission(email, env);
  if (!permission) {
    throw new Error(`Permission for ${email} not found`);
  }
  permission.notifications = notifications;
  await setUserPermission(email, permission, env);
}

export async function getUserDataPage(
  env: Env,
  input: { cursor?: string; limit: number }
): Promise<UserDataPage> {
  const rows = await env.AUTH_DB.prepare(
    `SELECT email, name, picture, role, accessLevel, blacklisted, createdAt
     FROM permission
     WHERE email > ?
     ORDER BY email
     LIMIT ?`
  )
    .bind(input.cursor ?? '', input.limit + 1)
    .all<{
      email: string;
      name: string;
      picture: string;
      role: AppRole;
      accessLevel: AccessLevel;
      blacklisted: number;
      createdAt: number | null;
    }>();
  const hasMore = rows.results.length > input.limit;
  const pageRows = rows.results.slice(0, input.limit);
  const users = pageRows.map((row) => ({
    id: row.email,
    email: row.email,
    name: row.name,
    picture: row.picture,
    role: row.role,
    accessLevel: row.accessLevel,
    blacklisted: row.blacklisted === 1,
    ...(row.createdAt === null ? {} : { createdAt: row.createdAt }),
  }));

  return {
    users,
    nextCursor: hasMore ? (pageRows.at(-1)?.email ?? null) : null,
  };
}
