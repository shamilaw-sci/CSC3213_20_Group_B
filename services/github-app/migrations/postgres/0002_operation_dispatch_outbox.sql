-- Apply after 0001. Only newly created operations are inserted by the outbox-enabled store.
CREATE TABLE operation_dispatch_outbox (
  operation_id TEXT PRIMARY KEY REFERENCES operation_state(operation_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dispatched_at TIMESTAMPTZ
);

CREATE INDEX operation_dispatch_outbox_pending_idx
  ON operation_dispatch_outbox (created_at, operation_id)
  WHERE dispatched_at IS NULL;
