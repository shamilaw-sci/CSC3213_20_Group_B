import {
  ACCESS_LEVEL,
  AccessLevelSchema,
  APP_ROLE,
  AppRoleSchema,
  ProfilePictureModeSchema,
  type AccessLevel,
  type AppRole,
  type ProfilePictureMode,
} from '@scs/schemas';

import type { Env } from '@/types/env';
import { requireD1 } from '@/types/env';
import { isRecord } from '@/utils/is-record';

export {
  ACCESS_LEVEL,
  APP_ROLE,
  type AccessLevel,
  type AppRole,
  type ProfilePictureMode,
};

type RepoRole = 'ADMIN' | 'EDITOR' | 'VIEWER';

function isRepoRoleMap(value: unknown): value is Record<string, RepoRole> {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (role) => role === 'ADMIN' || role === 'EDITOR' || role === 'VIEWER'
    )
  );
}

function parseStoredPermission(value: unknown): Permission | null {
  if (!isRecord(value)) return null;
  const role = normalizeAppRole(value.role) ?? APP_ROLE.USER;
  const accessLevel =
    normalizeAccessLevel(value.accessLevel) ?? ACCESS_LEVEL.NONE;
  const permission: Permission = { role, accessLevel };
  if (isRepoRoleMap(value.include)) permission.include = value.include;
  if (
    Array.isArray(value.exclude) &&
    value.exclude.every((item) => typeof item === 'string')
  ) {
    permission.exclude = value.exclude;
  }
  if (typeof value.blacklisted === 'boolean') {
    permission.blacklisted = value.blacklisted;
  }
  if (isRecord(value.notifications)) {
    const { email, push } = value.notifications;
    permission.notifications = {
      ...(typeof email === 'boolean' ? { email } : {}),
      ...(typeof push === 'boolean' ? { push } : {}),
    };
  }
  if (typeof value.name === 'string') permission.name = value.name;
  if (typeof value.picture === 'string') permission.picture = value.picture;
  if (typeof value.gravatarMail === 'string')
    permission.gravatarMail = value.gravatarMail;
  if (isProfilePictureMode(value.pictureMode)) {
    permission.pictureMode = value.pictureMode;
  }
  if (typeof value.createdAt === 'number' && Number.isFinite(value.createdAt)) {
    permission.createdAt = value.createdAt;
  }
  return permission;
}

export function parsePermissionJson(value: unknown): Permission | null {
  try {
    const parsed = parseStoredPermission(
      typeof value === 'string' ? JSON.parse(value) : value
    );
    return parsed ? sanitizePermission(parsed) : null;
  } catch {
    return null;
  }
}

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

export function normalizeAppRole(value: unknown): AppRole | null {
  const parsed = AppRoleSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function normalizeAccessLevel(value: unknown): AccessLevel | null {
  const parsed = AccessLevelSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function isProfilePictureMode(
  value: unknown
): value is ProfilePictureMode {
  return ProfilePictureModeSchema.safeParse(value).success;
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

export function sanitizePermission(permission: Permission): Permission {
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

export function permissionUserData(
  email: string,
  permission: Permission
): UserData {
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
  if (env.PERMISSION_REPOSITORY)
    return env.PERMISSION_REPOSITORY.hasOtherSuperAdmin(email);
  const result = await requireD1(env)
    .prepare(
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
  if (env.PERMISSION_REPOSITORY) return env.PERMISSION_REPOSITORY.get(email);
  const sanitizedEmail = email.toLowerCase();
  const row = await requireD1(env)
    .prepare('SELECT permissionJson FROM permission WHERE email = ? LIMIT 1')
    .bind(sanitizedEmail)
    .first<{ permissionJson: string }>();
  if (!row) return null;

  return parsePermissionJson(row.permissionJson);
}

export async function setUserPermission(
  email: string,
  permission: Permission,
  env: Env
): Promise<void> {
  if (env.PERMISSION_REPOSITORY)
    return env.PERMISSION_REPOSITORY.set(email, permission);
  const sanitizedEmail = email.toLowerCase();
  const sanitizedPermission = sanitizePermission(permission);
  const user = permissionUserData(sanitizedEmail, sanitizedPermission);
  await requireD1(env)
    .prepare(
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
  if (env.PERMISSION_REPOSITORY) return env.PERMISSION_REPOSITORY.delete(email);
  const sanitizedEmail = email.toLowerCase();
  await requireD1(env)
    .prepare('DELETE FROM permission WHERE email = ?')
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
  if (env.PERMISSION_REPOSITORY) return env.PERMISSION_REPOSITORY.list(input);
  const rows = await requireD1(env)
    .prepare(
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

export interface PermissionRepository {
  hasOtherSuperAdmin(email: string): Promise<boolean>;
  get(email: string): Promise<Permission | null>;
  set(email: string, permission: Permission): Promise<void>;
  delete(email: string): Promise<void>;
  list(input: { cursor?: string; limit: number }): Promise<UserDataPage>;
}

export class LastSuperAdminError extends Error {
  constructor() {
    super('Cannot remove the last super-admin account');
  }
}
