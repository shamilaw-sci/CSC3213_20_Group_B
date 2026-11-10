import type { Env } from '@/types/env';

interface AvatarRateRow {
  windowStart: number;
  attempts: number;
}

export interface AvatarRateRepository {
  read(username: string): Promise<AvatarRateRow | null>;
  consume(username: string, windowStart: number): Promise<number | null>;
  reset(username: string): Promise<void>;
}

export function createD1AvatarRateRepository(
  db: D1Database
): AvatarRateRepository {
  return {
    async read(username) {
      return db
        .prepare(
          'SELECT window_start AS windowStart, attempts FROM public_avatar_rate WHERE user_id = ?'
        )
        .bind(username)
        .first<AvatarRateRow>();
    },
    async consume(username, windowStart) {
      const row = await db
        .prepare(
          'INSERT INTO public_avatar_rate (user_id, window_start, attempts) VALUES (?, ?, 1) ON CONFLICT(user_id) DO UPDATE SET window_start = excluded.window_start, attempts = CASE WHEN window_start = excluded.window_start THEN attempts + 1 ELSE 1 END RETURNING attempts'
        )
        .bind(username, windowStart)
        .first<{ attempts: number }>();
      return row?.attempts ?? null;
    },
    async reset(username) {
      await db
        .prepare('DELETE FROM public_avatar_rate WHERE user_id = ?')
        .bind(username)
        .run();
    },
  };
}

export function avatarRateRepository(env: Env): AvatarRateRepository {
  return (
    env.AVATAR_RATE_REPOSITORY ?? createD1AvatarRateRepository(env.AUTH_DB)
  );
}
