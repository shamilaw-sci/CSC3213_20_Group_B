import type {
  CreateOperationResult,
  OperationStore,
} from '@/operations/operation.store';
import { OperationRecordSchema } from '@/operations/operation.types';
import type { OperationRecord } from '@/operations/operation.types';
import type { OperationStateNamespace } from '@/operations/cloudflare.types';

export class CloudflareOperationStore implements OperationStore {
  constructor(private readonly namespace: OperationStateNamespace) {}

  async create(operation: OperationRecord): Promise<CreateOperationResult> {
    const result = await this.namespace
      .getByName(operation.operationId)
      .create(operation);
    return {
      created: result.created,
      operation: OperationRecordSchema.parse(result.operation),
    };
  }

  async get(operationId: string): Promise<OperationRecord | null> {
    const operation = await this.namespace.getByName(operationId).get();
    return operation ? OperationRecordSchema.parse(operation) : null;
  }

  async save(operation: OperationRecord): Promise<void> {
    await this.namespace.getByName(operation.operationId).save(operation);
  }

  async requestCancellation(
    operationId: string,
    timestamp: string
  ): Promise<OperationRecord | null> {
    const operation = await this.namespace
      .getByName(operationId)
      .requestCancellation(timestamp);
    return operation ? OperationRecordSchema.parse(operation) : null;
  }
}
