import { DurableObject } from 'cloudflare:workers';
import { z } from 'zod';

import type { CreateOperationResult } from '@/operations/operation.store';
import {
  OperationRecordSchema,
  requestOperationCancellation,
} from '@/operations/operation.types';
import type { OperationRecord } from '@/operations/operation.types';
import type { GithubAppEnv } from '@/types/env';

const TimestampSchema = z.iso.datetime({ offset: true });
const INITIAL_DISPATCH_DELAY_MS = 1_000;
const DISPATCH_RETRY_MS = 30_000;

interface StoredOperationRow {
  [key: string]: string;
  operation_json: string;
}

export class OperationStateDurableObject extends DurableObject<GithubAppEnv> {
  constructor(ctx: DurableObjectState, env: GithubAppEnv) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS operation_state (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        operation_json TEXT NOT NULL
      )
    `);
  }

  async create(value: OperationRecord): Promise<CreateOperationResult> {
    const existing = this.read();
    if (existing) {
      if (
        existing.status === 'queued' &&
        (await this.ctx.storage.getAlarm()) === null
      ) {
        await this.ctx.storage.setAlarm(Date.now() + INITIAL_DISPATCH_DELAY_MS);
      }
      return { created: false, operation: existing };
    }

    const operation = OperationRecordSchema.parse(value);
    // Schedule recovery before persisting the command so an acknowledged
    // operation cannot be stranded if the request dies before Queue.send.
    await this.ctx.storage.setAlarm(Date.now() + INITIAL_DISPATCH_DELAY_MS);
    this.write(operation);
    return { created: true, operation };
  }

  async alarm(): Promise<void> {
    const operation = this.read();
    if (!operation || operation.status !== 'queued') return;
    try {
      if (!this.env.OPERATION_QUEUE)
        throw new Error('Operation queue unavailable');
      await this.env.OPERATION_QUEUE.send({
        operationId: operation.operationId,
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          event: 'operation_dispatch_retry',
          operationId: operation.operationId,
          errorCategory: error instanceof Error ? error.name : 'unknown',
        })
      );
      await this.ctx.storage.setAlarm(Date.now() + DISPATCH_RETRY_MS);
    }
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
