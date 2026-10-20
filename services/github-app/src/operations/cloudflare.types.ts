import type { CreateOperationResult } from '@/operations/operation.store';
import type {
  OperationQueueMessage,
  OperationRecord,
} from '@/operations/operation.types';

interface OperationStateStub {
  create(operation: OperationRecord): Promise<CreateOperationResult>;
  get(): Promise<OperationRecord | null>;
  save(operation: OperationRecord): Promise<void>;
  requestCancellation(timestamp: string): Promise<OperationRecord | null>;
}

export interface OperationStateNamespace {
  getByName(name: string): OperationStateStub;
}

interface MutationCoordinatorStub {
  acquire(operationId: string, leaseMs: number): Promise<boolean>;
  release(operationId: string): Promise<void>;
}

export interface MutationCoordinatorNamespace {
  getByName(name: string): MutationCoordinatorStub;
}

export interface OperationQueue {
  send(message: OperationQueueMessage): Promise<void>;
}

export interface OperationQueueBatch {
  messages: readonly {
    body: OperationQueueMessage;
    ack(): void;
    retry(options?: { delaySeconds?: number }): void;
  }[];
}
