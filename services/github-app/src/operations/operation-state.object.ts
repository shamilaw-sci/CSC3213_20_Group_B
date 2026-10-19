import { DurableObject } from 'cloudflare:workers';
import { z } from 'zod';

import type { CreateOperationResult } from '@/operations/operation.store';
import {
  OperationRecordSchema,
  requestOperationCancellation,
} from '@/operations/operation.types';
import type { OperationRecord } from '@/operations/operation.types';

const TimestampSchema = z.iso.datetime({ offset: true });

interface StoredOperationRow {
  [key: string]: string;
  operation_json: string;
}

export class OperationStateDurableObject extends DurableObject<unknown> {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS operation_state (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        operation_json TEXT NOT NULL
      )
    `);
  }

  create(value: OperationRecord): CreateOperationResult {
    const existing = this.read();
    if (existing) return { created: false, operation: existing };

    const operation = OperationRecordSchema.parse(value);
    this.write(operation);
    return { created: true, operation };
  }

  get(): OperationRecord | null {
    return this.read();
  }

  save(value: OperationRecord): void {
    const operation = OperationRecordSchema.parse(value);
    const existing = this.read();
    this.write({
      ...operation,
      ...(existing?.cancellationRequested
        ? { cancellationRequested: true }
        : {}),
    });
  }

  requestCancellation(timestampValue: string): OperationRecord | null {
    const existing = this.read();
    if (!existing) return null;

    const timestamp = TimestampSchema.parse(timestampValue);
    const operation = requestOperationCancellation(existing, timestamp);
    this.write(operation);
    return operation;
  }

  private read(): OperationRecord | null {
    const row = this.ctx.storage.sql
      .exec<StoredOperationRow>(
        'SELECT operation_json FROM operation_state WHERE singleton = 1'
      )
      .toArray()[0];
    return row
      ? OperationRecordSchema.parse(JSON.parse(row.operation_json))
      : null;
  }

  private write(operation: OperationRecord): void {
    this.ctx.storage.sql.exec(
      `INSERT INTO operation_state (singleton, operation_json)
       VALUES (1, ?)
       ON CONFLICT(singleton) DO UPDATE SET operation_json = excluded.operation_json`,
      JSON.stringify(operation)
    );
  }
}
