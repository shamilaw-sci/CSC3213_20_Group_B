import type { OperationRecord } from '@/operations/operation.types';

export interface CreateOperationResult {
  created: boolean;
  operation: OperationRecord;
}

export interface OperationStore {
  create(operation: OperationRecord): Promise<CreateOperationResult>;
  get(operationId: string): Promise<OperationRecord | null>;
  save(operation: OperationRecord): Promise<void>;
  requestCancellation(
    operationId: string,
    timestamp: string
  ): Promise<OperationRecord | null>;
}
