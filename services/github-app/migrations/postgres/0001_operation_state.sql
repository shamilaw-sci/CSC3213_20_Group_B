-- Durable operation state. Operation IDs are unique across all instances.
CREATE TABLE operation_state (
  operation_id TEXT PRIMARY KEY,
  operation_json JSONB NOT NULL,
  CONSTRAINT operation_state_identity_check CHECK (
    jsonb_typeof(operation_json) = 'object'
    AND operation_json ->> 'operationId' = operation_id
  )
);
