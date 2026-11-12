import { OperationIdSchema, OperationStatusResponseSchema } from '@scs/schemas';

import { CloudflareOperationStore } from '@/operations/cloudflare-operation.store';
import {
  cleanupFailedPullRequest,
  OperationCleanupConflictError,
} from '@/operations/operation.cleanup';
import {
  CloudflareMutationCoordinator,
  MutationResourceBusyError,
} from '@/operations/mutation-coordinator';
import { localOperationStore } from '@/operations/in-memory-operation.store';
import type { OperationStore } from '@/operations/operation.store';
import { inspectPublication } from '@/operations/publication';
import {
  toOperationStatusResponse,
  type OperationRecord,
} from '@/operations/operation.types';
import type { GithubAppEnv } from '@/types/env';

function operationStore(env: GithubAppEnv): OperationStore {
  if (env.OPERATION_STORE) return env.OPERATION_STORE;
  return env.OPERATION_STATE
    ? new CloudflareOperationStore(env.OPERATION_STATE)
    : localOperationStore;
}

function actorAuthorization(request: Request): {
  subjectId: string;
  admin: boolean;
} | null {
  const subjectId = request.headers.get('X-Actor-Subject-Id')?.trim();
  if (!subjectId) return null;
  return {
    subjectId,
    admin: request.headers.get('X-Actor-Admin') === 'true',
  };
}

async function authorizedOperation(
  request: Request,
  env: GithubAppEnv,
  operationIdInput: string
): Promise<
  | { ok: false; response: Response }
  | { ok: true; operation: OperationRecord; store: OperationStore }
> {
  const operationId = OperationIdSchema.safeParse(operationIdInput);
  if (!operationId.success) {
    return {
      ok: false,
      response: Response.json(
        { error: 'Invalid operation ID' },
        { status: 400 }
      ),
    };
  }
  const actor = actorAuthorization(request);
  if (!actor) {
    return {
      ok: false,
      response: Response.json(
        { error: 'Actor identity required' },
        { status: 401 }
      ),
    };
  }
  const store = operationStore(env);
  const operation = await store.get(operationId.data);
  if (!operation) {
    return {
      ok: false,
      response: Response.json(
        { error: 'Operation not found' },
        { status: 404 }
      ),
    };
  }
  if (!actor.admin && actor.subjectId !== operation.actor.subjectId) {
    return {
      ok: false,
      response: Response.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }
  return { ok: true, operation, store };
}

export async function handleGetOperation(
  request: Request,
  env: GithubAppEnv,
  operationId: string
): Promise<Response> {
  const authorized = await authorizedOperation(request, env, operationId);
  if (!authorized.ok) return authorized.response;
  const response = toOperationStatusResponse(authorized.operation);
  if (response.status !== 'succeeded' || !response.outcome.pullRequest) {
    return Response.json(response);
  }
  try {
    const publication = await inspectPublication(authorized.operation);
    return Response.json(
      OperationStatusResponseSchema.parse({
        ...response,
        publication: publication.state,
        cleanupEligible: publication.cleanupEligible,
      })
    );
  } catch {
    return Response.json(
      OperationStatusResponseSchema.parse({
        ...response,
        publication: 'unknown',
        cleanupEligible: false,
      })
    );
  }
}

export async function handleCancelOperation(
  request: Request,
  env: GithubAppEnv,
  operationId: string
): Promise<Response> {
  const authorized = await authorizedOperation(request, env, operationId);
  if (!authorized.ok) return authorized.response;
  const operation = await authorized.store.requestCancellation(
    authorized.operation.operationId,
    new Date().toISOString()
  );
  if (!operation) {
    return Response.json({ error: 'Operation not found' }, { status: 404 });
  }
  return Response.json(toOperationStatusResponse(operation));
}

export async function handleCleanupOperation(
  request: Request,
  env: GithubAppEnv,
  operationId: string
): Promise<Response> {
  const authorized = await authorizedOperation(request, env, operationId);
  if (!authorized.ok) return authorized.response;
  const operation = authorized.operation;
  if (
    operation.status !== 'succeeded' ||
    operation.outcome?.status !== 'succeeded' ||
    !operation.outcome.pullRequest
  ) {
    return Response.json(
      { error: 'Operation has no PR to clean up' },
      { status: 409 }
    );
  }
  const coordinator =
    env.OPERATION_COORDINATOR ??
    (env.MUTATION_COORDINATOR
      ? new CloudflareMutationCoordinator(env.MUTATION_COORDINATOR)
      : null);
  if (!coordinator) {
    return Response.json(
      { error: 'Mutation coordinator unavailable' },
      { status: 503 }
    );
  }
  try {
    const updated = await coordinator.runExclusive(
      `${operation.resource.type}:${operation.resource.id}`,
      `cleanup:${operation.operationId}`,
      async () =>
        cleanupFailedPullRequest(
          (await authorized.store.get(operation.operationId)) ?? operation,
          authorized.store
        )
    );
    return Response.json(
      OperationStatusResponseSchema.parse({
        ...toOperationStatusResponse(updated),
        publication: 'cleaned_up',
        cleanupEligible: false,
      })
    );
  } catch (error) {
    if (error instanceof MutationResourceBusyError) {
      return Response.json(
        { error: 'A mutation is still active' },
        { status: 409 }
      );
    }
    if (error instanceof OperationCleanupConflictError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
