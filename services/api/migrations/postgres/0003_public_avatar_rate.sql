-- Mirrors D1 migration 0006. The single-statement UPSERT remains atomic.
CREATE TABLE public_avatar_rate (
  user_id TEXT PRIMARY KEY,
  window_start BIGINT NOT NULL,
  attempts INTEGER NOT NULL
);
