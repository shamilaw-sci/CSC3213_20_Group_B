import { createHash } from 'node:crypto';

import type { OperationStore } from '@/operations/operation.store';
import type {
  OperationCommand,
  OperationErrorClassification,
  OperationHandler,
  OperationLogEntry,
  OperationRecord,
} from '@/operations/operation.types';
import type { MutationCoordinator } from '@/operations/mutation-coordinator';

const TERMINAL_STATUSES = new Set([
  'succeeded',
  'failed',
  'conflicted',
  'cancelled',
]);

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)])
    );
  }
  return value;
}

function digest(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

export function operationIdentity(command: OperationCommand): {
  operationId: string;
  idempotencyHash: string;
} {
  return {
    operationId: `op_${digest({
      actor: command.actor,
      idempotencyKey: command.idempotencyKey,
    })}`,
    idempotencyHash: digest({
      actor: command.actor,
      action: command.action,
      resource: command.resource,
      payload: command.payload,
    }),
  };
}

export class OperationIdempotencyConflictError extends Error {
  constructor(public readonly operationId: string) {
    super(
      `The idempotency key for ${operationId} was reused for another input`
    );
    this.name = 'OperationIdempotencyConflictError';
  }
}

interface OperationExecutorOptions {
  store: OperationStore;
  coordinator: MutationCoordinator;
  handlers: Record<string, OperationHandler>;
  classifyError?: (error: unknown) => OperationErrorClassification;
  maxAttempts?: number;
  now?: () => Date;
  sleep?: (delayMs: number) => Promise<void>;
  log?: (entry: OperationLogEntry) => void;
  dispatch?: (operationId: string) => Promise<void>;
}

export class OperationExecutor {
  private readonly maxAttempts: number;
  private readonly now: () => Date;
  private readonly sleep: (delayMs: number) => Promise<void>;
  private readonly classifyError: (
    error: unknown
  ) => OperationErrorClassification;
  private readonly log: (entry: OperationLogEntry) => void;

  constructor(private readonly options: OperationExecutorOptions) {
    this.maxAttempts = options.maxAttempts ?? 3;
    this.now = options.now ?? (() => new Date());
    this.sleep =
      options.sleep ??
      ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
    this.classifyError =
      options.classifyError ??
      (() => ({ category: 'unknown', retryable: false }));
    this.log = options.log ?? ((entry) => console.info(JSON.stringify(entry)));
  }

  async submit(command: OperationCommand): Promise<OperationRecord> {
    const identity = operationIdentity(command);
    const timestamp = this.now().toISOString();
    const created = await this.options.store.create({
      version: 1,
      ...identity,
      idempotencyKey: command.idempotencyKey,
      actor: command.actor,
      resource: command.resource,
      action: command.action,
      payload: command.payload,
      correlationId: command.correlationId,
      status: 'queued',
      attempt: 0,
      maxAttempts: this.maxAttempts,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    if (created.operation.idempotencyHash !== identity.idempotencyHash) {
      throw new OperationIdempotencyConflictError(identity.operationId);
    }
    if (created.created) {
      this.writeLog('operation_queued', created.operation);
      await this.options.dispatch?.(created.operation.operationId);
    }
    return created.operation;
  }

  async execute(operationId: string): Promise<OperationRecord> {
    const initial = await this.requireOperation(operationId);
    if (TERMINAL_STATUSES.has(initial.status)) return initial;
    const resourceKey = `${initial.resource.type}:${initial.resource.id}`;

    return await this.options.coordinator.runExclusive(
      resourceKey,
      operationId,
      async () => await this.executeExclusive(operationId)
    );
  }

  async cancel(operationId: string): Promise<OperationRecord> {
    const operation = await this.options.store.requestCancellation(
      operationId,
      this.now().toISOString()
    );
    if (!operation) throw new Error(`Operation ${operationId} was not found`);
    this.writeLog(
      operation.status === 'cancelled'
        ? 'operation_cancelled'
        : 'operation_cancellation_requested',
      operation
    );
    return operation;
  }

  private async completeCancellation(
    operation: OperationRecord
  ): Promise<OperationRecord> {
    return await this.cancel(operation.operationId);
  }

  private async executeExclusive(
    operationId: string
  ): Promise<OperationRecord> {
    let operation = await this.requireOperation(operationId);
    if (TERMINAL_STATUSES.has(operation.status)) return operation;
    const handler = this.options.handlers[operation.action];
    if (!handler) {
      return await this.fail(operation, 'unknown_action', 'Unknown operation');
    }

    if (!operation.startedAt) {
      operation = {
        ...operation,
        status: 'running',
        startedAt: this.now().toISOString(),
        updatedAt: this.now().toISOString(),
      };
      await this.options.store.save(operation);
    }

    while (operation.attempt < operation.maxAttempts) {
      const latest = await this.requireOperation(operationId);
      if (latest.cancellationRequested) {
        return await this.completeCancellation(latest);
      }
      operation = {
        ...latest,
        status: 'running',
        attempt: operation.attempt + 1,
        updatedAt: this.now().toISOString(),
        lastErrorCategory: undefined,
      };
      await this.options.store.save(operation);
      this.writeLog('operation_attempt_started', operation);

      try {
        const outcome = await handler(
          {
            idempotencyKey: operation.idempotencyKey,
            actor: operation.actor,
            resource: operation.resource,
            action: operation.action,
            payload: operation.payload,
            correlationId: operation.correlationId,
          },
          operation
        );
        const timestamp = this.now().toISOString();
        const succeeded: OperationRecord = {
          ...operation,
          status: 'succeeded',
          outcome,
          updatedAt: timestamp,
          completedAt: timestamp,
        };
        await this.options.store.save(succeeded);
        this.writeLog('operation_succeeded', succeeded);
        return succeeded;
      } catch (error) {
        const classification = this.classifyError(error);
        operation = {
          ...operation,
          lastErrorCategory: classification.category,
          updatedAt: this.now().toISOString(),
        };
        await this.options.store.save(operation);
        this.writeLog('operation_attempt_failed', operation);

        if (
          classification.retryable &&
          operation.attempt < operation.maxAttempts
        ) {
          const exponentialDelay = Math.min(
            30_000,
            250 * 2 ** (operation.attempt - 1)
          );
          await this.sleep(
            Math.min(
              30_000,
              Math.max(exponentialDelay, classification.retryAfterMs ?? 0)
            )
          );
          continue;
        }
        if (classification.category === 'compare_conflict') {
          return await this.conflict(operation);
        }
        return await this.fail(
          operation,
          classification.category === 'unknown'
            ? 'operation_failed'
            : classification.category,
          'Operation could not be completed'
        );
      }
    }

    return await this.fail(
      operation,
      'retry_exhausted',
      'Operation retry limit was exhausted'
    );
  }

  private async conflict(operation: OperationRecord): Promise<OperationRecord> {
    const timestamp = this.now().toISOString();
    const conflicted: OperationRecord = {
      ...operation,
      status: 'conflicted',
      updatedAt: timestamp,
      completedAt: timestamp,
      outcome: {
        status: 'conflicted',
        error: {
          code: 'repository_conflict',
          message: 'The repository changed; refresh and retry',
          correlationId: operation.correlationId,
          conflict: {
            resourceType: operation.resource.type,
            resourceId: operation.resource.id,
          },
        },
      },
    };
    await this.options.store.save(conflicted);
    this.writeLog('operation_conflicted', conflicted);
    return conflicted;
  }

  private async fail(
    operation: OperationRecord,
    code: string,
    message: string
  ): Promise<OperationRecord> {
    const timestamp = this.now().toISOString();
    const failed: OperationRecord = {
      ...operation,
      status: 'failed',
      updatedAt: timestamp,
      completedAt: timestamp,
      outcome: {
        status: 'failed',
        error: { code, message, correlationId: operation.correlationId },
      },
    };
    await this.options.store.save(failed);
    this.writeLog('operation_failed', failed);
    return failed;
  }

  private async requireOperation(
    operationId: string
  ): Promise<OperationRecord> {
    const operation = await this.options.store.get(operationId);
    if (!operation) throw new Error(`Operation ${operationId} was not found`);
    return operation;
  }

  private writeLog(event: string, operation: OperationRecord): void {
    this.log({
      event,
      operationId: operation.operationId,
      correlationId: operation.correlationId,
      resourceType: operation.resource.type,
      resourceId: operation.resource.id,
      action: operation.action,
      ...(operation.attempt > 0 ? { attempt: operation.attempt } : {}),
      ...(operation.lastErrorCategory
        ? { errorCategory: operation.lastErrorCategory }
        : {}),
    });
  }
}
