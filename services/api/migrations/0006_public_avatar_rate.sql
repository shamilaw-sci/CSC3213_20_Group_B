CREATE TABLE IF NOT EXISTS public_avatar_rate (
  user_id TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);
