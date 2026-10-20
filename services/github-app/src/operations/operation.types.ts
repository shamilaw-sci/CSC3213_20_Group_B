import {
  IdempotencyKeySchema,
  OperationActorSchema,
  OperationOutcomeSchema,
  OperationResourceSchema,
  OperationStatusSchema,
  OperationStatusResponseSchema,
} from '@scs/schemas';
import type {
  OperationActor,
  OperationOutcome,
  OperationResource,
  OperationStatusResponse,
} from '@scs/schemas';
import { z } from 'zod';

export interface OperationCommand<TPayload = unknown> {
  idempotencyKey: string;
  actor: OperationActor;
  resource: OperationResource;
  action: string;
  payload: TPayload;
  correlationId: string;
}

export interface OperationQueueMessage {
  operationId: string;
}

export const OperationRecordSchema = z
  .object({
    version: z.literal(1),
    operationId: z.string().min(16).max(128),
    idempotencyHash: z.string().regex(/^[a-f0-9]{64}$/),
    idempotencyKey: IdempotencyKeySchema,
    actor: OperationActorSchema,
    resource: OperationResourceSchema,
    action: z.string().trim().min(1).max(128),
    payload: z.unknown(),
    correlationId: z.string().trim().min(8).max(128),
    status: OperationStatusSchema,
    attempt: z.number().int().nonnegative(),
    maxAttempts: z.number().int().positive().max(10),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
    startedAt: z.iso.datetime({ offset: true }).optional(),
    completedAt: z.iso.datetime({ offset: true }).optional(),
    outcome: OperationOutcomeSchema.optional(),
    lastErrorCategory: z.string().trim().min(1).max(64).optional(),
    cancellationRequested: z.boolean().optional(),
  })
  .strict();

export type OperationRecord = z.infer<typeof OperationRecordSchema>;

export function requestOperationCancellation(
  operation: OperationRecord,
  timestamp: string
): OperationRecord {
  if (
    operation.status === 'succeeded' ||
    operation.status === 'failed' ||
    operation.status === 'conflicted' ||
    operation.status === 'cancelled'
  ) {
    return operation;
  }
  if (operation.status === 'running') {
    return {
      ...operation,
      cancellationRequested: true,
      updatedAt: timestamp,
    };
  }
  return {
    ...operation,
    status: 'cancelled',
    cancellationRequested: true,
    updatedAt: timestamp,
    completedAt: timestamp,
    outcome: {
      status: 'cancelled',
      error: {
        code: 'operation_cancelled',
        message: 'Operation cancelled before completion',
        correlationId: operation.correlationId,
      },
    },
  };
}

type OperationSuccess = Extract<OperationOutcome, { status: 'succeeded' }>;

export type OperationHandler = (
  command: OperationCommand,
  operation: OperationRecord
) => Promise<OperationSuccess>;

export interface OperationErrorClassification {
  category: string;
  retryable: boolean;
  retryAfterMs?: number;
}

export interface OperationLogEntry {
  event: string;
  operationId: string;
  correlationId: string;
  resourceType: string;
  resourceId: string;
  action: string;
  attempt?: number;
  errorCategory?: string;
}

export function toOperationStatusResponse(
  record: OperationRecord
): OperationStatusResponse {
  const base = {
    version: 1 as const,
    operationId: record.operationId,
    resource: record.resource,
    actor: record.actor,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };

  if (record.status === 'queued') return { ...base, status: 'queued' };
  if (record.status === 'running') {
    return OperationStatusResponseSchema.parse({
      ...base,
      status: 'running',
      startedAt: record.startedAt ?? record.updatedAt,
    });
  }

  if (!record.completedAt || !record.outcome) {
    throw new Error(`Terminal operation ${record.operationId} has no outcome`);
  }
  return OperationStatusResponseSchema.parse({
    ...base,
    status: record.status,
    completedAt: record.completedAt,
    outcome: record.outcome,
  });
}
