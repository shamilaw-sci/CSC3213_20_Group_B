import type { Pool } from 'pg';

import { createPostgresAuthIdentityRepository } from '@/repositories/auth-accounts.postgres';
import { createPostgresPermissionRepository } from '@/repositories/permissions.postgres';
import { createPostgresProxySettingsRepository } from '@/repositories/proxy-settings.postgres';
import { createPostgresAvatarRateRepository } from '@/repositories/public-avatar-rate.postgres';
import { createPostgresAvatarReviewRepository } from '@/repositories/public-avatar.postgres';
import type { Env } from '@/types/env';

type RelationalBindings = Pick<
  Env,
  | 'AUTH_DATABASE'
  | 'AUTH_IDENTITY_REPOSITORY'
  | 'PERMISSION_REPOSITORY'
  | 'PROXY_SETTINGS_REPOSITORY'
  | 'AVATAR_RATE_REPOSITORY'
  | 'AVATAR_REVIEW_REPOSITORY'
>;

/** Bun/Node composition root only. All relational repositories share one pool. */
export function createPostgresRelationalBindings(
  pool: Pool
): RelationalBindings {
  return {
    AUTH_DATABASE: pool,
    AUTH_IDENTITY_REPOSITORY: createPostgresAuthIdentityRepository(pool),
    PERMISSION_REPOSITORY: createPostgresPermissionRepository(pool),
    PROXY_SETTINGS_REPOSITORY: createPostgresProxySettingsRepository(pool),
    AVATAR_RATE_REPOSITORY: createPostgresAvatarRateRepository(pool),
    AVATAR_REVIEW_REPOSITORY: createPostgresAvatarReviewRepository(pool),
  };
}
