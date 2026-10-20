import { SignJWT } from 'jose';

import { PROXY_DEFAULT_AVAILABLE_ATTEMPTS } from '@/config/client.config';
import { importProxySettings } from '@/repositories/proxy-settings.repo';
import type { Env } from '@/types/env';

const SOURCE_PATH = '/config/v1/all.json';
const SOURCE_MAX_BYTES = 1024 * 1024;
const SOURCE_MAX_ENTRIES = 10_000;
const TOKEN_TTL_SECONDS = 60;

interface LegacyProxySettings {
  email: string;
  username: string;
  active: boolean;
  url: string;
  availableAttempts: number;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ProxySettingsMigrationResult {
  scanned: number;
  created: number;
  alreadyPresent: number;
  conflicts: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseLegacyProxySettings(value: unknown): LegacyProxySettings[] {
  if (!isObject(value) || value.schemaVersion !== 1 || !isObject(value.users)) {
    throw new Error('Legacy proxy aggregate has an invalid schema');
  }
  const users = Object.entries(value.users);
  if (users.length > SOURCE_MAX_ENTRIES) {
    throw new Error('Legacy proxy aggregate exceeds the entry limit');
  }

  return users.map(([email, user]) => {
    if (!email || !isObject(user) || typeof user.username !== 'string') {
      throw new Error('Legacy proxy aggregate contains an invalid user');
    }
    const proxy = user.proxy;
    if (
      !isObject(proxy) ||
      typeof proxy.active !== 'boolean' ||
      typeof proxy.url !== 'string' ||
      (proxy.availableAttempts !== undefined &&
        (typeof proxy.availableAttempts !== 'number' ||
          !Number.isInteger(proxy.availableAttempts) ||
          proxy.availableAttempts < 0 ||
          proxy.availableAttempts > PROXY_DEFAULT_AVAILABLE_ATTEMPTS)) ||
      (proxy.updatedAt !== undefined &&
        (typeof proxy.updatedAt !== 'string' ||
          !Number.isFinite(Date.parse(proxy.updatedAt)))) ||
      (proxy.updatedBy !== undefined && typeof proxy.updatedBy !== 'string')
    ) {
      throw new Error('Legacy proxy aggregate contains invalid settings');
    }
    return {
      email: email.trim().toLowerCase(),
      username: user.username.trim().toLowerCase(),
      active: proxy.active,
      url: proxy.url,
      availableAttempts:
        typeof proxy.availableAttempts === 'number'
          ? proxy.availableAttempts
          : PROXY_DEFAULT_AVAILABLE_ATTEMPTS,
      ...(typeof proxy.updatedAt === 'string'
        ? { updatedAt: proxy.updatedAt }
        : {}),
      ...(typeof proxy.updatedBy === 'string'
        ? { updatedBy: proxy.updatedBy }
        : {}),
    };
  });
}

async function createMigrationSourceUrl(env: Env, actorEmail: string) {
  const token = await new SignJWT({
    scope: 'proxy:read:all',
    path: SOURCE_PATH,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(actorEmail)
    .setIssuer(env.CONFIG_ACCESS_TOKEN_ISSUER)
    .setAudience('config.scs.pdn.ac.lk')
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .setJti(crypto.randomUUID())
    .sign(new TextEncoder().encode(env.CONFIG_ACCESS_TOKEN_SECRET));
  const url = new URL(SOURCE_PATH, env.CONFIG_DATA_BASE_URL);
  url.searchParams.set('access_token', token);
  return url;
}

async function readMigrationSource(
  env: Env,
  actorEmail: string
): Promise<LegacyProxySettings[]> {
  const response = await fetch(
    await createMigrationSourceUrl(env, actorEmail),
    {
      headers: { Accept: 'application/json' },
    }
  );
  if (!response.ok) {
    throw new Error(`Legacy proxy aggregate returned ${response.status}`);
  }
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > SOURCE_MAX_BYTES) {
    throw new Error('Legacy proxy aggregate exceeds the byte limit');
  }
  const body = await response.text();
  if (new TextEncoder().encode(body).byteLength > SOURCE_MAX_BYTES) {
    throw new Error('Legacy proxy aggregate exceeds the byte limit');
  }
  return parseLegacyProxySettings(JSON.parse(body) as unknown);
}

/**
 * One-time, insert-only migration from the signed legacy aggregate. Input size
 * limits protect the Worker from an unexpectedly large or malformed source;
 * remove this action and its source credentials after production cutover.
 */
export async function migrateProxySettings(
  env: Env,
  actorEmail: string
): Promise<ProxySettingsMigrationResult> {
  const source = await readMigrationSource(env, actorEmail);
  const result: ProxySettingsMigrationResult = {
    scanned: source.length,
    created: 0,
    alreadyPresent: 0,
    conflicts: [],
  };

  for (const settings of source) {
    const status = await importProxySettings(env, settings);
    if (status === 'created') result.created += 1;
    if (status === 'already_present') result.alreadyPresent += 1;
    if (status === 'conflict') result.conflicts.push(settings.email);
  }
  return result;
}
