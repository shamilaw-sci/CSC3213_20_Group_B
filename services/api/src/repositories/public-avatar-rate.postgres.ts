import type { Pool } from 'pg';

import type { AvatarRateRepository } from '@/repositories/public-avatar-rate.repo';

/** Bun/Node adapter. PostgreSQL locks the conflicted row during the UPSERT. */
export function createPostgresAvatarRateRepository(
  pool: Pool
): AvatarRateRepository {
  return {
    async read(username) {
      const result = await pool.query<{
        windowStart: string;
        attempts: number;
      }>(
        'SELECT window_start AS "windowStart", attempts FROM public_avatar_rate WHERE user_id = $1',
        [username]
      );
      const row = result.rows[0];
      if (!row) return null;
      const windowStart = Number(row.windowStart);
      if (!Number.isSafeInteger(windowStart))
        throw new Error('Invalid avatar rate window');
      return { windowStart, attempts: row.attempts };
    },
    async consume(username, windowStart) {
      const result = await pool.query<{ attempts: number }>(
        'INSERT INTO public_avatar_rate (user_id, window_start, attempts) VALUES ($1, $2, 1) ON CONFLICT (user_id) DO UPDATE SET window_start = EXCLUDED.window_start, attempts = CASE WHEN public_avatar_rate.window_start = EXCLUDED.window_start THEN public_avatar_rate.attempts + 1 ELSE 1 END RETURNING attempts',
        [username, windowStart]
      );
      return result.rows[0]?.attempts ?? null;
    },
    async reset(username) {
      await pool.query('DELETE FROM public_avatar_rate WHERE user_id = $1', [
        username,
      ]);
    },
  };
}
