import {
  HonoursBulkOperationRequestSchema,
  type HonoursBulkOperationRequest,
} from '@scs/schemas';

import type { HonoursBulkRepository } from '@/domains/honours/honours.repository';
import type {
  OperationCommand,
  OperationHandler,
} from '@/operations/operation.types';

export const HONOURS_BULK_ACTION = 'honours.bulk';

export function createHonoursBulkCommand(input: {
  request: HonoursBulkOperationRequest;
  actorSubjectId: string;
  idempotencyKey: string;
  correlationId: string;
}): OperationCommand<{ request: HonoursBulkOperationRequest }> {
  return {
    idempotencyKey: input.idempotencyKey,
    actor: { type: 'user', subjectId: input.actorSubjectId },
    resource: { type: 'honours_batch', id: input.request.batch },
    action: HONOURS_BULK_ACTION,
    payload: { request: input.request },
    correlationId: input.correlationId,
  };
}

export function createHonoursBulkHandler(
  repository: HonoursBulkRepository
): OperationHandler {
  return async (command, operation) => {
    const payload = HonoursBulkOperationRequestSchema.parse(
      (command.payload as { request?: unknown }).request
    );
    const result = await repository.saveDraft(payload, operation.operationId);
    return {
      status: 'succeeded',
      revision: result.revision,
      pullRequest: result.pullRequest,
    };
  };
}
