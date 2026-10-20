import type { AcademicDraftRepository } from '@/domains/academics/academic.repository';
import type {
  OperationCommand,
  OperationHandler,
} from '@/operations/operation.types';

type AcademicRegistryKind = 'course' | 'offering';

const ACADEMIC_UPSERT_ACTION = 'academic.upsert';
const ACADEMIC_DELETE_ACTION = 'academic.delete';

export interface AcademicOperationRequest {
  action: 'upsert' | 'delete';
  kind: AcademicRegistryKind;
  id: string;
  updatedBy: string;
  recordPath: string;
  expectedRevision?: string;
  record?: Record<string, unknown>;
}

interface AcademicOperationPayload {
  request: AcademicOperationRequest;
}

export function createAcademicOperationCommand(input: {
  request: AcademicOperationRequest;
  actorSubjectId: string;
  idempotencyKey: string;
  correlationId: string;
}): OperationCommand<AcademicOperationPayload> {
  return {
    idempotencyKey: input.idempotencyKey,
    actor: { type: 'user', subjectId: input.actorSubjectId },
    resource: { type: input.request.kind, id: input.request.id },
    action:
      input.request.action === 'delete'
        ? ACADEMIC_DELETE_ACTION
        : ACADEMIC_UPSERT_ACTION,
    payload: { request: input.request },
    correlationId: input.correlationId,
  };
}

export function createAcademicOperationHandlers(
  repository: AcademicDraftRepository
): Record<string, OperationHandler> {
  const handler: OperationHandler = async (command, operation) => {
    const payload = command.payload as AcademicOperationPayload;
    const result = await repository.saveDraft(payload.request, {
      operationId: operation.operationId,
    });
    return {
      status: 'succeeded',
      revision: result.revision,
      ...(result.pullRequest ? { pullRequest: result.pullRequest } : {}),
    };
  };

  return {
    [ACADEMIC_UPSERT_ACTION]: handler,
    [ACADEMIC_DELETE_ACTION]: handler,
  };
}
