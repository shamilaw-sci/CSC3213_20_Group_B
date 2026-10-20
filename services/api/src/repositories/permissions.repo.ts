import type { Env } from '@/types/env';
import {
  MAX_USERS_PER_REQUEST,
  PERMISSION_BATCH_SIZE,
  PERMISSION_LIST_PAGE_LIMIT,
} from '@/config/client.config';

/**
 * Repo-level roles
 */
type RepoRole = 'ADMIN' | 'EDITOR' | 'VIEWER';

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

export const PROFILE_PICTURE_MODES = [
  'google',
  'github',
  'manual',
  'gravatar',
] as const;

export type ProfilePictureMode = (typeof PROFILE_PICTURE_MODES)[number];

export interface PasskeyCredential {
  id: string;
  publicKey: string;
  counter: number;
  transports?: (
    'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb'
  )[];
  backedUp: boolean;
  deviceType: 'singleDevice' | 'multiDevice';
  rpId: string;
  createdAt: number;
  lastUsedAt?: number;
  name?: string;
}

/**
 * Permission object stored in KV
 */
export interface Permission {
  /**
   * Person/category role.
   */
  role: AppRole;

  /**
   * Management access inherited on top of the person role.
   */
  accessLevel?: AccessLevel;

  /**
   * Repo allow rules
   */
  include?: Record<string, RepoRole>;

  /**
   * Repo deny rules
   */
  exclude?: string[];

  /**
   * Blacklist flag (for quick revocation)
   */
  blacklisted?: boolean;

  /**
   * GitHub userID (for alternative auth)
   */
  githubUserID?: number;

  /**
   * Notification preferences
   */
  notifications?: {
    email?: boolean;
    push?: boolean;
  };

  /**
   * Timestamp of last password change
   */
  lastPasswordChanged?: number;

  /**
   * Enabled OAuth providers
   */
  oAuthProviders?: {
    google?: boolean;
    github?: boolean;
  };

  /**
   * Registered WebAuthn passkeys
   */
  passkeys?: PasskeyCredential[];

  /**
   * Display name (from OAuth provider or signup)
   */
  name?: string;

  /**
   * Profile picture URL (from OAuth provider or signup)
   */
  picture?: string;

  /**
   * Rule that controls how the profile picture URL is updated.
   */
  pictureMode?: ProfilePictureMode;

  /**
   * Custom Gravatar email when it differs from the user's university email.
   */
  gravatarMail?: string;

  /**
   * Unix timestamp (ms) when the user was first registered
   */
  createdAt?: number;
}

/**
 * User data returned by admin APIs (excluding sensitive info like lastPasswordChanged)
 */
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

export function hasAppRole(
  permission: Permission | null | undefined,
  roles: AppRole[]
): boolean {
  return roles.includes(getPermissionRole(permission));
}

export function isSuperAdmin(permission?: Permission | null): boolean {
  return getPermissionAccessLevel(permission) === ACCESS_LEVEL.SUPER_ADMIN;
}

export function isAdmin(permission?: Permission | null): boolean {
  const accessLevel = getPermissionAccessLevel(permission);
  return (
    accessLevel === ACCESS_LEVEL.ADMIN ||
    accessLevel === ACCESS_LEVEL.SUPER_ADMIN
  );
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
  if ('githubUserID' in patch) normalized.githubUserID = patch.githubUserID;
  if ('notifications' in patch) normalized.notifications = patch.notifications;
  if ('lastPasswordChanged' in patch) {
    normalized.lastPasswordChanged = patch.lastPasswordChanged;
  }
  if ('oAuthProviders' in patch)
    normalized.oAuthProviders = patch.oAuthProviders;
  if ('passkeys' in patch) normalized.passkeys = patch.passkeys;
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
  if ('githubUserID' in permission)
    sanitized.githubUserID = permission.githubUserID;
  if ('notifications' in permission) {
    sanitized.notifications = permission.notifications;
  }
  if ('lastPasswordChanged' in permission) {
    sanitized.lastPasswordChanged = permission.lastPasswordChanged;
  }
  if ('oAuthProviders' in permission) {
    sanitized.oAuthProviders = permission.oAuthProviders;
  }
  if ('passkeys' in permission) sanitized.passkeys = permission.passkeys;
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

function isUserData(value: unknown): value is UserData {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Partial<UserData>;
  return (
    typeof candidate.email === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.picture === 'string' &&
    isAppRole(candidate.role) &&
    isAccessLevel(candidate.accessLevel) &&
    typeof candidate.blacklisted === 'boolean'
  );
}

export async function hasOtherSuperAdmin(
  email: string,
  env: Env
): Promise<boolean> {
  const targetEmail = email.toLowerCase();
  let cursor: string | undefined;

  do {
    const result = await env.PERMISSIONS.list({
      prefix: 'permissions:',
      cursor,
      limit: PERMISSION_LIST_PAGE_LIMIT,
    });

    for (const kvKey of result.keys) {
      const currentEmail = kvKey.name.slice('permissions:'.length);
      if (currentEmail.toLowerCase() === targetEmail) continue;

      const permission = await getUserPermission(currentEmail, env);
      if (isSuperAdmin(permission)) {
        return true;
      }
    }

    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);

  return false;
}

/**
 * KV key helper
 */
function key(email: string): string {
  return `permissions:${email.toLowerCase()}`;
}

/**
 * Get permission
 */
export async function getUserPermission(
  email: string,
  env: Env
): Promise<Permission | null> {
  const sanitizedEmail = email.toLowerCase();
  const data = await env.PERMISSIONS.get(key(sanitizedEmail));

  if (!data) return null;

  try {
    return sanitizePermission(JSON.parse(data) as Permission);
  } catch {
    return null;
  }
}

/**
 * Save permission
 */
export async function setUserPermission(
  email: string,
  permission: Permission,
  env: Env
): Promise<void> {
  const sanitizedEmail = email.toLowerCase();
  const sanitizedPermission = sanitizePermission(permission);
  await env.PERMISSIONS.put(
    key(sanitizedEmail),
    JSON.stringify(sanitizedPermission),
    { metadata: permissionUserData(sanitizedEmail, sanitizedPermission) }
  );
}

/**
 * Delete permission
 */
export async function deleteUserPermission(
  email: string,
  env: Env
): Promise<void> {
  const sanitizedEmail = email.toLowerCase();
  await env.PERMISSIONS.delete(key(sanitizedEmail));
}

/**
 * Set github user ID for a permission
 */
export async function setGithubUserID(
  email: string,
  githubUserID: number,
  env: Env
): Promise<void> {
  const permission = await getUserPermission(email, env);
  if (!permission) {
    throw new Error(`Permission for ${email} not found`);
  }

  await setUserPermission(
    email,
    {
      ...permission,
      githubUserID,
      oAuthProviders: {
        ...permission.oAuthProviders,
        github: true,
      },
    },
    env
  );
}

/**
 * SetNotifications preferences for a permission
 */
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

/**
 * Get all permissions (for admin user list)
 */
export async function getUserDataPage(
  env: Env,
  input: { cursor?: string; limit: number }
): Promise<UserDataPage> {
  const result = await env.PERMISSIONS.list<UserData>({
    prefix: 'permissions:',
    cursor: input.cursor,
    limit: input.limit,
  });
  const users: UserData[] = [];

  for (
    let start = 0;
    start < result.keys.length;
    start += PERMISSION_BATCH_SIZE
  ) {
    const keys = result.keys.slice(start, start + PERMISSION_BATCH_SIZE);
    const fallbackPermissions = await Promise.all(
      keys.map(async (kvKey) => {
        if (isUserData(kvKey.metadata)) return null;
        const email = kvKey.name.slice('permissions:'.length);
        const permission = await getUserPermission(email, env);
        if (permission) await setUserPermission(email, permission, env);
        return permission;
      })
    );

    for (let index = 0; index < keys.length; index += 1) {
      const kvKey = keys[index];
      if (isUserData(kvKey.metadata)) {
        users.push(kvKey.metadata);
        continue;
      }
      const permission = fallbackPermissions[index];
      if (!permission) continue;
      const email = kvKey.name.slice('permissions:'.length);
      users.push(permissionUserData(email, permission));
    }
  }

  return {
    users,
    nextCursor: result.list_complete ? null : result.cursor,
  };
}

export async function getAllUserData(env: Env): Promise<UserData[]> {
  const users: UserData[] = [];
  let cursor: string | undefined;

  do {
    const remaining = MAX_USERS_PER_REQUEST - users.length;
    if (remaining <= 0) break;
    const page = await getUserDataPage(env, {
      cursor,
      limit: Math.min(PERMISSION_LIST_PAGE_LIMIT, remaining),
    });
    users.push(...page.users.slice(0, remaining));
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  return users;
}
