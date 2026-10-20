import type { Env } from '@/types/env';
import {
  getUserPermission,
  setUserPermission,
} from '@/repositories/permissions.repo';

interface LegacyPasskey {
  id: string;
  publicKey: string;
  counter: number;
  transports?: string[];
  backedUp: boolean;
  deviceType: 'singleDevice' | 'multiDevice';
  createdAt?: number;
  name?: string;
}

interface LegacyIdentity {
  githubUserID?: number;
  name?: string;
  picture?: string;
  createdAt?: number;
  passkeys?: LegacyPasskey[];
}

export interface LegacyAuthMigrationResult {
  scanned: number;
  usersCreated: number;
  githubAccountsCreated: number;
  passkeysCreated: number;
  permissionsCleaned: number;
  skipped: number;
  conflicts: string[];
}

function isLegacyPasskey(value: unknown): value is LegacyPasskey {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Partial<LegacyPasskey>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.publicKey === 'string' &&
    typeof candidate.counter === 'number' &&
    typeof candidate.backedUp === 'boolean' &&
    (candidate.deviceType === 'singleDevice' ||
      candidate.deviceType === 'multiDevice')
  );
}

function readLegacyIdentity(value: string): LegacyIdentity | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    const containsLegacyAuth = [
      'githubUserID',
      'lastPasswordChanged',
      'oAuthProviders',
      'passkeys',
    ].some((field) => Object.hasOwn(record, field));
    if (!containsLegacyAuth) return null;

    return {
      ...(typeof record.githubUserID === 'number'
        ? { githubUserID: record.githubUserID }
        : {}),
      ...(typeof record.name === 'string' ? { name: record.name } : {}),
      ...(typeof record.picture === 'string'
        ? { picture: record.picture }
        : {}),
      ...(typeof record.createdAt === 'number'
        ? { createdAt: record.createdAt }
        : {}),
      ...(Array.isArray(record.passkeys)
        ? { passkeys: record.passkeys.filter(isLegacyPasskey) }
        : {}),
    };
  } catch {
    return null;
  }
}

async function stableId(prefix: string, value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `${prefix}_${hex.slice(0, 32)}`;
}

export function normalizeLegacyPasskeyPublicKey(publicKey: string): string {
  const normalized = publicKey.replaceAll('-', '+').replaceAll('_', '/');
  return normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
}

async function migrateIdentity(
  email: string,
  identity: LegacyIdentity,
  env: Env,
  result: LegacyAuthMigrationResult
): Promise<void> {
  if (!identity.githubUserID && !identity.passkeys?.length) {
    result.skipped += 1;
    return;
  }

  const existingUser = await env.AUTH_DB.prepare(
    'SELECT id FROM "user" WHERE lower(email) = ? LIMIT 1'
  )
    .bind(email)
    .first<{ id: string }>();
  const userId = existingUser?.id ?? (await stableId('usr', email));
  const now = Date.now();
  if (!existingUser) {
    const inserted = await env.AUTH_DB.prepare(
      'INSERT OR IGNORE INTO "user" (id, name, email, emailVerified, image, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?, ?)'
    )
      .bind(
        userId,
        identity.name?.trim() || email.split('@')[0] || email,
        email,
        identity.picture ?? null,
        identity.createdAt ?? now,
        now
      )
      .run();
    result.usersCreated += inserted.meta.changes ?? 0;
  }

  if (identity.githubUserID) {
    const accountId = String(identity.githubUserID);
    const existing = await env.AUTH_DB.prepare(
      'SELECT userId FROM account WHERE providerId = ? AND accountId = ? LIMIT 1'
    )
      .bind('github', accountId)
      .first<{ userId: string }>();
    if (existing && existing.userId !== userId) {
      result.conflicts.push(`${email}:github:${accountId}`);
    } else if (!existing) {
      const inserted = await env.AUTH_DB.prepare(
        'INSERT OR IGNORE INTO account (id, accountId, providerId, userId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)'
      )
        .bind(
          await stableId('acct', `github:${accountId}`),
          accountId,
          'github',
          userId,
          now,
          now
        )
        .run();
      result.githubAccountsCreated += inserted.meta.changes ?? 0;
      if ((inserted.meta.changes ?? 0) === 0) {
        const owner = await env.AUTH_DB.prepare(
          'SELECT userId FROM account WHERE providerId = ? AND accountId = ? LIMIT 1'
        )
          .bind('github', accountId)
          .first<{ userId: string }>();
        if (owner && owner.userId !== userId) {
          result.conflicts.push(`${email}:github:${accountId}`);
        }
      }
    }
  }

  for (const passkey of identity.passkeys ?? []) {
    const existing = await env.AUTH_DB.prepare(
      'SELECT userId FROM passkey WHERE credentialID = ? LIMIT 1'
    )
      .bind(passkey.id)
      .first<{ userId: string }>();
    if (existing && existing.userId !== userId) {
      result.conflicts.push(`${email}:passkey:${passkey.id}`);
      continue;
    }
    if (existing) continue;

    const inserted = await env.AUTH_DB.prepare(
      'INSERT OR IGNORE INTO passkey (id, name, publicKey, userId, credentialID, counter, deviceType, backedUp, transports, createdAt, aaguid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)'
    )
      .bind(
        await stableId('pkey', passkey.id),
        passkey.name ?? null,
        normalizeLegacyPasskeyPublicKey(passkey.publicKey),
        userId,
        passkey.id,
        passkey.counter,
        passkey.deviceType,
        passkey.backedUp ? 1 : 0,
        passkey.transports?.join(',') ?? '',
        passkey.createdAt ?? now
      )
      .run();
    result.passkeysCreated += inserted.meta.changes ?? 0;
    if ((inserted.meta.changes ?? 0) === 0) {
      const owner = await env.AUTH_DB.prepare(
        'SELECT userId FROM passkey WHERE credentialID = ? LIMIT 1'
      )
        .bind(passkey.id)
        .first<{ userId: string }>();
      if (owner && owner.userId !== userId) {
        result.conflicts.push(`${email}:passkey:${passkey.id}`);
      }
    }
  }
}

export async function migrateLegacyAuth(
  env: Env
): Promise<LegacyAuthMigrationResult> {
  const result: LegacyAuthMigrationResult = {
    scanned: 0,
    usersCreated: 0,
    githubAccountsCreated: 0,
    passkeysCreated: 0,
    permissionsCleaned: 0,
    skipped: 0,
    conflicts: [],
  };
  let cursor: string | undefined;

  do {
    const page = await env.PERMISSIONS.list({
      prefix: 'permissions:',
      cursor,
      limit: 100,
    });
    for (const key of page.keys) {
      result.scanned += 1;
      const email = key.name.slice('permissions:'.length).toLowerCase();
      const raw = await env.PERMISSIONS.get(key.name);
      const identity = raw ? readLegacyIdentity(raw) : null;
      if (!identity) {
        result.skipped += 1;
        continue;
      }
      const conflictCount = result.conflicts.length;
      await migrateIdentity(email, identity, env, result);
      if (result.conflicts.length === conflictCount) {
        const permission = await getUserPermission(email, env);
        if (permission) {
          await setUserPermission(email, permission, env);
          result.permissionsCleaned += 1;
        }
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  return result;
}
