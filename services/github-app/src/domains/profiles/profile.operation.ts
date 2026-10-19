import type { ProfileDraftRepository } from '@/domains/profiles/profile.repository';
import type {
  ProfileDraftRequest,
  ProfileOperationPayload,
} from '@/domains/profiles/profile.types';
import type {
  OperationCommand,
  OperationHandler,
} from '@/operations/operation.types';

export const PROFILE_UPSERT_ACTION = 'profile.upsert';

export function createProfileOperationCommand(input: {
  request: ProfileDraftRequest;
  actorSubjectId: string;
  idempotencyKey: string;
  correlationId: string;
}): OperationCommand<ProfileOperationPayload> {
  return {
    idempotencyKey: input.idempotencyKey,
    actor: { type: 'user', subjectId: input.actorSubjectId },
    resource: { type: 'profile', id: input.request.username },
    action: PROFILE_UPSERT_ACTION,
    payload: { request: input.request },
    correlationId: input.correlationId,
  };
}

export function createProfileOperationHandler(
  repository: ProfileDraftRepository
): OperationHandler {
  return async (command, operation) => {
    const payload = command.payload as ProfileOperationPayload;
    const result = await repository.saveDraft(payload.request, {
      operationId: operation.operationId,
    });
    return {
      status: 'succeeded',
      revision: result.revision,
      pullRequest: result.pullRequest,
    };
  };
}
