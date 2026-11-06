CREATE TABLE IF NOT EXISTS public_avatar_review (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  object_key TEXT NOT NULL,
  size INTEGER NOT NULL,
  moderation_json TEXT NOT NULL CHECK (json_valid("moderation_json")),
  status TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'approved', 'rejected')),
  submitted_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  reviewed_by TEXT,
  review_note TEXT
);

CREATE INDEX IF NOT EXISTS public_avatar_review_username_idx
  ON public_avatar_review ("username");

CREATE INDEX IF NOT EXISTS public_avatar_review_status_idx
  ON public_avatar_review ("status", "submitted_at");

CREATE TABLE IF NOT EXISTS public_avatar_audit (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  actor_kind TEXT NOT NULL CHECK ("actor_kind" IN ('owner', 'admin')),
  action TEXT NOT NULL CHECK ("action" IN ('upload', 'delete', 'admin_delete', 'review_submitted', 'review_approved', 'review_rejected')),
  previous_sha256 TEXT,
  sha256 TEXT,
  review_id TEXT,
  note TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS public_avatar_audit_username_idx
  ON public_avatar_audit ("username", "created_at");

CREATE INDEX IF NOT EXISTS public_avatar_audit_created_at_idx
  ON public_avatar_audit ("created_at");
