import {
  PROXY_ATTEMPTS_RESET_WINDOW_MS,
  PROXY_DEFAULT_AVAILABLE_ATTEMPTS,
} from '@/config/client.config';
import type { Env } from '@/types/env';

export interface ProxySettings {
  email: string;
  username: string;
  active: boolean;
  url: string;
  availableAttempts: number;
  updatedAt?: string;
  updatedBy?: string;
  revision: number;
}

export interface ProxySettingsRow {
  email: string;
  username: string;
  active: number;
  url: string;
  availableAttempts: number;
  attemptWindowStartedAt: number | null;
  updatedAt: number | null;
  updatedBy: string | null;
  revision: number;
}

export type SaveProxySettingsResult =
  | { status: 'saved'; settings: ProxySettings }
  | { status: 'attempts_exhausted' };

export interface ProxySettingsPage {
  settings: ProxySettings[];
  nextEmail: string | null;
  total: number;
}

export interface ActiveProxyResolution {
  url: string;
}

export interface ProxySettingsRepository {
  get(email: string): Promise<ProxySettings>;
  resolve(username: string): Promise<ActiveProxyResolution | null>;
  save(
    input: Omit<SaveProxySettingsInput, 'env'>
  ): Promise<SaveProxySettingsResult>;
  reset(email: string, actorEmail: string): Promise<ProxySettings>;
  listPage(input: {
    afterEmail?: string;
    limit: number;
  }): Promise<ProxySettingsPage>;
}

export interface SaveProxySettingsInput {
  env: Env;
  email: string;
  actorEmail: string;
  actorIsAdmin: boolean;
  active: boolean;
  url: string;
}

export function emailToUsername(email: string): string {
  return email.split('@')[0]?.toLowerCase() ?? email.toLowerCase();
}

export function toProxySettings(row: ProxySettingsRow): ProxySettings {
  const availableAttempts =
    row.attemptWindowStartedAt !== null &&
    Date.now() - row.attemptWindowStartedAt > PROXY_ATTEMPTS_RESET_WINDOW_MS
      ? PROXY_DEFAULT_AVAILABLE_ATTEMPTS
      : row.availableAttempts;
  return {
    email: row.email,
    username: row.username,
    active: row.active === 1,
    url: row.url,
    availableAttempts,
    ...(row.updatedAt === null
      ? {}
      : { updatedAt: new Date(row.updatedAt).toISOString() }),
    ...(row.updatedBy === null ? {} : { updatedBy: row.updatedBy }),
    revision: row.revision,
  };
}

export function defaultProxySettings(email: string): ProxySettings {
  const normalizedEmail = email.trim().toLowerCase();
  return {
    email: normalizedEmail,
    username: emailToUsername(normalizedEmail),
    active: false,
    url: '',
    availableAttempts: PROXY_DEFAULT_AVAILABLE_ATTEMPTS,
    revision: 0,
  };
}

/**
 * Lazily persists an expired attempt-window reset. The compare-and-set guard
 * prevents a stale read from overwriting an edit that completed concurrently.
 */
export async function getProxySettings(
  env: Env,
  email: string
): Promise<ProxySettings> {
  if (env.PROXY_SETTINGS_REPOSITORY)
    return env.PROXY_SETTINGS_REPOSITORY.get(email);
  const normalizedEmail = email.trim().toLowerCase();
  const row = await env.AUTH_DB.prepare(
    'SELECT email, username, active, url, availableAttempts, attemptWindowStartedAt, updatedAt, updatedBy, revision FROM proxySettings WHERE email = ? LIMIT 1'
  )
    .bind(normalizedEmail)
    .first<ProxySettingsRow>();
  if (!row) return defaultProxySettings(normalizedEmail);

  if (
    row.attemptWindowStartedAt !== null &&
    Date.now() - row.attemptWindowStartedAt > PROXY_ATTEMPTS_RESET_WINDOW_MS &&
    row.availableAttempts !== PROXY_DEFAULT_AVAILABLE_ATTEMPTS
  ) {
    const reset = await env.AUTH_DB.prepare(
      'UPDATE proxySettings SET availableAttempts = ?, attemptWindowStartedAt = NULL, revision = revision + 1 WHERE email = ? AND attemptWindowStartedAt = ? RETURNING email, username, active, url, availableAttempts, attemptWindowStartedAt, updatedAt, updatedBy, revision'
    )
      .bind(
        PROXY_DEFAULT_AVAILABLE_ATTEMPTS,
        normalizedEmail,
        row.attemptWindowStartedAt
      )
      .first<ProxySettingsRow>();
    if (reset) return toProxySettings(reset);
    const current = await env.AUTH_DB.prepare(
      'SELECT email, username, active, url, availableAttempts, attemptWindowStartedAt, updatedAt, updatedBy, revision FROM proxySettings WHERE email = ? LIMIT 1'
    )
      .bind(normalizedEmail)
      .first<ProxySettingsRow>();
    if (current) return toProxySettings(current);
  }

  return toProxySettings(row);
}

export async function getActiveProxyByUsername(
  env: Env,
  username: string
): Promise<ActiveProxyResolution | null> {
  if (env.PROXY_SETTINGS_REPOSITORY)
    return env.PROXY_SETTINGS_REPOSITORY.resolve(username);
  const result = await env.AUTH_DB.prepare(
    'SELECT url FROM proxySettings WHERE username = ? AND active = 1 ORDER BY email LIMIT 2'
  )
    .bind(username)
    .all<ActiveProxyResolution>();
  return result.results.length === 1 ? result.results[0] : null;
}

/**
 * Updates settings and consumes a user's allowance in one statement. Keep
 * the counter predicate inside this UPSERT; a separate read/update sequence
 * would allow concurrent requests to exceed the configured allowance. Admin
 * edits intentionally preserve the target user's remaining attempts.
 */
export async function saveProxySettings(
  input: SaveProxySettingsInput
): Promise<SaveProxySettingsResult> {
  if (input.env.PROXY_SETTINGS_REPOSITORY) {
    return input.env.PROXY_SETTINGS_REPOSITORY.save({
      email: input.email,
      actorEmail: input.actorEmail,
      actorIsAdmin: input.actorIsAdmin,
      active: input.active,
      url: input.url,
    });
  }
  const email = input.email.trim().toLowerCase();
  const now = Date.now();
  const windowCutoff = now - PROXY_ATTEMPTS_RESET_WINDOW_MS;
  const row = input.actorIsAdmin
    ? await input.env.AUTH_DB.prepare(
        'INSERT INTO proxySettings (email, username, active, url, availableAttempts, attemptWindowStartedAt, updatedAt, updatedBy, revision) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, 1) ON CONFLICT(email) DO UPDATE SET active = excluded.active, url = excluded.url, updatedAt = excluded.updatedAt, updatedBy = excluded.updatedBy, revision = proxySettings.revision + 1 RETURNING email, username, active, url, availableAttempts, attemptWindowStartedAt, updatedAt, updatedBy, revision'
      )
        .bind(
          email,
          emailToUsername(email),
          input.active,
          input.url,
          PROXY_DEFAULT_AVAILABLE_ATTEMPTS,
          now,
          input.actorEmail
        )
        .first<ProxySettingsRow>()
    : await input.env.AUTH_DB.prepare(
        'INSERT INTO proxySettings (email, username, active, url, availableAttempts, attemptWindowStartedAt, updatedAt, updatedBy, revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1) ON CONFLICT(email) DO UPDATE SET active = excluded.active, url = excluded.url, availableAttempts = CASE WHEN proxySettings.attemptWindowStartedAt IS NULL OR proxySettings.attemptWindowStartedAt <= ? THEN ? ELSE proxySettings.availableAttempts - 1 END, attemptWindowStartedAt = CASE WHEN proxySettings.attemptWindowStartedAt IS NULL OR proxySettings.attemptWindowStartedAt <= ? THEN excluded.attemptWindowStartedAt ELSE proxySettings.attemptWindowStartedAt END, updatedAt = excluded.updatedAt, updatedBy = excluded.updatedBy, revision = proxySettings.revision + 1 WHERE proxySettings.attemptWindowStartedAt IS NULL OR proxySettings.attemptWindowStartedAt <= ? OR proxySettings.availableAttempts > 0 RETURNING email, username, active, url, availableAttempts, attemptWindowStartedAt, updatedAt, updatedBy, revision'
      )
        .bind(
          email,
          emailToUsername(email),
          input.active,
          input.url,
          PROXY_DEFAULT_AVAILABLE_ATTEMPTS - 1,
          now,
          now,
          input.actorEmail,
          windowCutoff,
          PROXY_DEFAULT_AVAILABLE_ATTEMPTS - 1,
          windowCutoff,
          windowCutoff
        )
        .first<ProxySettingsRow>();

  return row
    ? { status: 'saved', settings: toProxySettings(row) }
    : { status: 'attempts_exhausted' };
}

export async function resetProxyAttempts(
  env: Env,
  email: string,
  actorEmail: string
): Promise<ProxySettings> {
  if (env.PROXY_SETTINGS_REPOSITORY)
    return env.PROXY_SETTINGS_REPOSITORY.reset(email, actorEmail);
  const normalizedEmail = email.trim().toLowerCase();
  const now = Date.now();
  const row = await env.AUTH_DB.prepare(
    'INSERT INTO proxySettings (email, username, active, url, availableAttempts, attemptWindowStartedAt, updatedAt, updatedBy, revision) VALUES (?, ?, 0, ?, ?, NULL, ?, ?, 1) ON CONFLICT(email) DO UPDATE SET availableAttempts = excluded.availableAttempts, attemptWindowStartedAt = NULL, updatedAt = excluded.updatedAt, updatedBy = excluded.updatedBy, revision = proxySettings.revision + 1 RETURNING email, username, active, url, availableAttempts, attemptWindowStartedAt, updatedAt, updatedBy, revision'
  )
    .bind(
      normalizedEmail,
      emailToUsername(normalizedEmail),
      '',
      PROXY_DEFAULT_AVAILABLE_ATTEMPTS,
      now,
      actorEmail
    )
    .first<ProxySettingsRow>();
  if (!row) throw new Error('D1 did not return reset proxy settings');
  return toProxySettings(row);
}

export async function listProxySettingsPage(
  env: Env,
  input: { afterEmail?: string; limit: number }
): Promise<ProxySettingsPage> {
  if (env.PROXY_SETTINGS_REPOSITORY)
    return env.PROXY_SETTINGS_REPOSITORY.listPage(input);
  const pageStatement = input.afterEmail
    ? env.AUTH_DB.prepare(
        'SELECT email, username, active, url, availableAttempts, attemptWindowStartedAt, updatedAt, updatedBy, revision FROM proxySettings WHERE email > ? ORDER BY email LIMIT ?'
      ).bind(input.afterEmail, input.limit + 1)
    : env.AUTH_DB.prepare(
        'SELECT email, username, active, url, availableAttempts, attemptWindowStartedAt, updatedAt, updatedBy, revision FROM proxySettings ORDER BY email LIMIT ?'
      ).bind(input.limit + 1);
  const countStatement = env.AUTH_DB.prepare(
    'SELECT count(*) AS total FROM proxySettings'
  );
  const [pageResult, countResult] = await env.AUTH_DB.batch<
    ProxySettingsRow | { total: number }
  >([pageStatement, countStatement]);
  const rows = pageResult.results as ProxySettingsRow[];
  const hasMore = rows.length > input.limit;
  const pageRows = rows.slice(0, input.limit);
  const total = Number(
    (countResult.results[0] as { total?: number } | undefined)?.total ?? 0
  );

  return {
    settings: pageRows.map(toProxySettings),
    nextEmail: hasMore ? (pageRows.at(-1)?.email ?? null) : null,
    total,
  };
}
