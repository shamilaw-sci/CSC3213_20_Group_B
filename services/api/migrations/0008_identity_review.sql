CREATE TABLE identity_review (
  email TEXT NOT NULL PRIMARY KEY COLLATE NOCASE REFERENCES permission(email) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'NEEDS_EVIDENCE', 'APPROVED', 'RETAINED_OTHER', 'CONFLICT')),
  source TEXT NOT NULL CHECK (source IN ('MANUAL', 'REVIEW', 'MIGRATION')),
  note TEXT NOT NULL DEFAULT '',
  reviewed_by TEXT NOT NULL,
  reviewed_at INTEGER NOT NULL
);

CREATE TABLE identity_audit (
  id TEXT NOT NULL PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  old_role TEXT NOT NULL,
  new_role TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  note TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX identity_audit_email_idx ON identity_audit(email, created_at DESC);

INSERT INTO identity_audit
  (id, email, old_role, new_role, status, source, note, actor_email, created_at)
SELECT lower(hex(randomblob(16))), email, role, 'STUDENT', 'APPROVED',
  'MIGRATION', 'Institutional student identifier role lock', 'migration',
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM permission
WHERE role <> 'STUDENT' AND (
  lower(email) GLOB 's[0-9][0-9][0-9][0-9][0-9]@sci.pdn.ac.lk' OR
  lower(email) GLOB 's[0-9][0-9]sp[0-9][0-9][0-9]@sci.pdn.ac.lk'
);

UPDATE permission
SET role = 'STUDENT', permissionJson = json_set(permissionJson, '$.role', 'STUDENT')
WHERE role <> 'STUDENT' AND (
  lower(email) GLOB 's[0-9][0-9][0-9][0-9][0-9]@sci.pdn.ac.lk' OR
  lower(email) GLOB 's[0-9][0-9]sp[0-9][0-9][0-9]@sci.pdn.ac.lk'
);

CREATE TABLE honours_operation_history (
  operation_id TEXT NOT NULL PRIMARY KEY,
  actor_email TEXT NOT NULL,
  batch TEXT NOT NULL,
  programme TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  changes_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  actor_subject_id TEXT,
  idempotency_key TEXT,
  correlation_id TEXT,
  apply_json TEXT,
  request_hash TEXT,
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending_acceptance', 'accepted', 'processing', 'awaiting_publication', 'published', 'failed')),
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  lease_until INTEGER NOT NULL DEFAULT 0,
  lease_token TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  accepted_at INTEGER,
  last_error TEXT
);

CREATE INDEX honours_operation_history_created_idx
  ON honours_operation_history(created_at DESC, operation_id DESC);
CREATE INDEX honours_operation_history_actor_idx
  ON honours_operation_history(actor_email, created_at DESC, operation_id DESC);
CREATE UNIQUE INDEX honours_operation_history_retry_idx
  ON honours_operation_history(actor_subject_id, idempotency_key);
CREATE UNIQUE INDEX honours_operation_history_active_request_idx
  ON honours_operation_history(actor_subject_id, request_hash)
  WHERE status IN ('pending_acceptance', 'accepted', 'processing', 'awaiting_publication');
CREATE INDEX honours_operation_history_due_idx
  ON honours_operation_history(next_attempt_at, lease_until)
  WHERE status IN ('pending_acceptance', 'accepted', 'processing', 'awaiting_publication');
