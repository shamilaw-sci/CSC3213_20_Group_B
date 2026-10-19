import type {
  CreateOperationResult,
  OperationStore,
} from '@/operations/operation.store';
import {
  requestOperationCancellation,
  type OperationRecord,
} from '@/operations/operation.types';

function copy(record: OperationRecord): OperationRecord {
  return structuredClone(record);
}

export class InMemoryOperationStore implements OperationStore {
  private readonly operations = new Map<string, OperationRecord>();

  create(operation: OperationRecord): Promise<CreateOperationResult> {
    const existing = this.operations.get(operation.operationId);
    if (existing) {
      return Promise.resolve({ created: false, operation: copy(existing) });
    }
    this.operations.set(operation.operationId, copy(operation));
    return Promise.resolve({ created: true, operation: copy(operation) });
  }

  get(operationId: string): Promise<OperationRecord | null> {
    const operation = this.operations.get(operationId);
    return Promise.resolve(operation ? copy(operation) : null);
  }

  save(operation: OperationRecord): Promise<void> {
    const existing = this.operations.get(operation.operationId);
    this.operations.set(
      operation.operationId,
      copy({
        ...operation,
        ...(existing?.cancellationRequested
          ? { cancellationRequested: true }
          : {}),
      })
    );
    return Promise.resolve();
  }

  requestCancellation(
    operationId: string,
    timestamp: string
  ): Promise<OperationRecord | null> {
    const existing = this.operations.get(operationId);
    if (!existing) return Promise.resolve(null);
    const operation = requestOperationCancellation(existing, timestamp);
    this.operations.set(operationId, copy(operation));
    return Promise.resolve(copy(operation));
  }
}

export const localOperationStore = new InMemoryOperationStore();
