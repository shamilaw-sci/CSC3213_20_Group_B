import { DurableObject } from 'cloudflare:workers';
import { OperationIdSchema } from '@scs/schemas';
import { z } from 'zod';

const LeaseDurationSchema = z.number().int().positive().max(300_000);

interface LeaseRow {
  [key: string]: string | number;
  operation_id: string;
  expires_at: number;
}

export class MutationCoordinatorDurableObject extends DurableObject<unknown> {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS resource_lease (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        operation_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);
  }

  acquire(operationIdValue: string, leaseMsValue: number): boolean {
    const operationId = OperationIdSchema.parse(operationIdValue);
    const leaseMs = LeaseDurationSchema.parse(leaseMsValue);
    const lease = this.ctx.storage.sql
      .exec<LeaseRow>(
        'SELECT operation_id, expires_at FROM resource_lease WHERE singleton = 1'
      )
      .toArray()[0];
    const now = Date.now();
    if (lease && lease.expires_at > now) {
      return false;
    }

    this.ctx.storage.sql.exec(
      `INSERT INTO resource_lease (singleton, operation_id, expires_at)
       VALUES (1, ?, ?)
       ON CONFLICT(singleton) DO UPDATE SET
         operation_id = excluded.operation_id,
         expires_at = excluded.expires_at`,
      operationId,
      now + leaseMs
    );
    return true;
  }

  release(operationIdValue: string): void {
    const operationId = OperationIdSchema.parse(operationIdValue);
    this.ctx.storage.sql.exec(
      'DELETE FROM resource_lease WHERE singleton = 1 AND operation_id = ?',
      operationId
    );
  }
}
