import { OperationIdSchema } from '@scs/schemas';

import { CloudflareOperationStore } from '@/operations/cloudflare-operation.store';
import { localOperationStore } from '@/operations/in-memory-operation.store';
import type { OperationStore } from '@/operations/operation.store';
import {
  toOperationStatusResponse,
  type OperationRecord,
} from '@/operations/operation.types';
import type { GithubAppEnv } from '@/types/env';

function operationStore(env: GithubAppEnv): OperationStore {
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
  return Response.json(toOperationStatusResponse(authorized.operation));
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
