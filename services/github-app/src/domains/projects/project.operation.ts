import type { ProjectDraftRepository } from '@/domains/projects/project.repository';
import type {
  OperationCommand,
  OperationHandler,
} from '@/operations/operation.types';

export const PROJECT_UPSERT_ACTION = 'project.upsert';
export const PROJECT_DELETE_ACTION = 'project.delete';

export interface ProjectOperationRequest {
  action: 'upsert' | 'delete';
  slug: string;
  updatedBy: string;
  projectPath: string;
  expectedRevision?: string;
  project?: Record<string, unknown>;
}

interface ProjectOperationPayload {
  request: ProjectOperationRequest;
}

export function createProjectOperationCommand(input: {
  request: ProjectOperationRequest;
  actorSubjectId: string;
  idempotencyKey: string;
  correlationId: string;
}): OperationCommand<ProjectOperationPayload> {
  return {
    idempotencyKey: input.idempotencyKey,
    actor: { type: 'user', subjectId: input.actorSubjectId },
    resource: { type: 'project', id: input.request.slug },
    action:
      input.request.action === 'delete'
        ? PROJECT_DELETE_ACTION
        : PROJECT_UPSERT_ACTION,
    payload: { request: input.request },
    correlationId: input.correlationId,
  };
}

export function createProjectOperationHandlers(
  repository: ProjectDraftRepository
): Record<string, OperationHandler> {
  const handler: OperationHandler = async (command, operation) => {
    const payload = command.payload as ProjectOperationPayload;
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
    [PROJECT_UPSERT_ACTION]: handler,
    [PROJECT_DELETE_ACTION]: handler,
  };
}
