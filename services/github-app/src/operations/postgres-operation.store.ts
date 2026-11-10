import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';

import type {
  CreateOperationResult,
  OperationStore,
} from '@/operations/operation.store';
import {
  OperationRecordSchema,
  requestOperationCancellation,
  type OperationRecord,
} from '@/operations/operation.types';

const TimestampSchema = z.iso.datetime({ offset: true });

interface StoredRow {
  operation_json: unknown;
}

function parseRow(row: StoredRow | undefined): OperationRecord | null {
  return row ? OperationRecordSchema.parse(row.operation_json) : null;
}

async function withTransaction<T>(
  pool: Pool,
  action: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await action(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Bun/Node adapter. The Cloudflare Worker does not import this module. */
export class PostgresOperationStore implements OperationStore {
  constructor(private readonly pool: Pool) {}

  async create(value: OperationRecord): Promise<CreateOperationResult> {
    // Match the Durable Object: an existing ID wins even if the new value is invalid.
    const existing = await this.get(value.operationId);
    if (existing) return { created: false, operation: existing };
    const operation = OperationRecordSchema.parse(value);
    const inserted = await this.pool.query<StoredRow>(
      `INSERT INTO operation_state (operation_id, operation_json)
       VALUES ($1, $2::jsonb) ON CONFLICT (operation_id) DO NOTHING
       RETURNING operation_json`,
      [operation.operationId, JSON.stringify(operation)]
    );
    if (inserted.rows[0])
      return { created: true, operation: parseRow(inserted.rows[0])! };
    // A competing insert won; the unique index waits for its commit before returning.
    const winner = await this.get(operation.operationId);
    if (!winner)
      throw new Error(
        `Operation ${operation.operationId} disappeared after create conflict`
      );
    return { created: false, operation: winner };
  }

  async get(operationId: string): Promise<OperationRecord | null> {
    const result = await this.pool.query<StoredRow>(
      'SELECT operation_json FROM operation_state WHERE operation_id = $1',
      [operationId]
    );
    return parseRow(result.rows[0]);
  }

  async save(value: OperationRecord): Promise<void> {
    const operation = OperationRecordSchema.parse(value);
    await withTransaction(this.pool, async (client) => {
      const current = await client.query<StoredRow>(
        'SELECT operation_json FROM operation_state WHERE operation_id = $1 FOR UPDATE',
        [operation.operationId]
      );
      const existing = parseRow(current.rows[0]);
      const next = {
        ...operation,
        ...(existing?.cancellationRequested
          ? { cancellationRequested: true }
          : {}),
      };
      await client.query(
        `INSERT INTO operation_state (operation_id, operation_json) VALUES ($1, $2::jsonb)
         ON CONFLICT (operation_id) DO UPDATE SET operation_json =
           CASE WHEN operation_state.operation_json ->> 'cancellationRequested' = 'true'
             THEN jsonb_set(EXCLUDED.operation_json, '{cancellationRequested}', 'true'::jsonb, true)
             ELSE EXCLUDED.operation_json END`,
        [operation.operationId, JSON.stringify(next)]
      );
    });
  }

  async requestCancellation(
    operationId: string,
    timestampValue: string
  ): Promise<OperationRecord | null> {
    return withTransaction(this.pool, async (client) => {
      const result = await client.query<StoredRow>(
        'SELECT operation_json FROM operation_state WHERE operation_id = $1 FOR UPDATE',
        [operationId]
      );
      const existing = parseRow(result.rows[0]);
      if (!existing) return null;
      const timestamp = TimestampSchema.parse(timestampValue);
      const operation = requestOperationCancellation(existing, timestamp);
      await client.query(
        'UPDATE operation_state SET operation_json = $2::jsonb WHERE operation_id = $1',
        [operationId, JSON.stringify(operation)]
      );
      return operation;
    });
  }
}
