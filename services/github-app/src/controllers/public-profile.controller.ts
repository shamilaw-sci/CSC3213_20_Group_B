import { ApiErrorEnvelopeSchema, MutationAcceptedSchema } from '@scs/schemas';
import {
  discardPublicProfilePrRequestSchema,
  getPublicProfileQuerySchema,
  submitPublicProfileOperationRequestSchema,
  updatePublicProfileRequestSchema,
} from '@scs/schemas';

import {
  getPublicProfile,
  getPublicProfilePrStatus,
  discardPublicProfilePr,
  PublicProfileRequestError,
  upsertPublicProfilePr,
} from '@/repositories/public-profile.repo';
import {
  createProfileOperationCommand,
  createProfileOperationHandler,
  PROFILE_UPSERT_ACTION,
} from '@/domains/profiles/profile.operation';
import { createProfileDraftRepository } from '@/domains/profiles/profile.repository';
import { createOperationExecutor } from '@/operations/queue.consumer';
import { OperationIdempotencyConflictError } from '@/operations/operation.executor';
import type { OperationRecord } from '@/operations/operation.types';
import type { GithubAppEnv } from '@/types/env';
import { createValidationErrorResponse, readJsonBody } from '@/utils/request';

export async function handleGetPublicProfile(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const query = getPublicProfileQuerySchema.safeParse({
    username: url.searchParams.get('username'),
  });

  if (!query.success) {
    return createValidationErrorResponse(query.error);
  }

  const result = await getPublicProfile(query.data.username);
  if (!result) {
    return Response.json({ profile: null }, { status: 404 });
  }

  return Response.json(result);
}

export async function handleGetPublicProfilePrStatus(
  req: Request
): Promise<Response> {
  const url = new URL(req.url);
  const query = getPublicProfileQuerySchema.safeParse({
    username: url.searchParams.get('username'),
  });

  if (!query.success) {
    return createValidationErrorResponse(query.error);
  }

  return Response.json(await getPublicProfilePrStatus(query.data.username));
}

export async function handleUpsertPublicProfilePr(
  req: Request
): Promise<Response> {
  const body = await readJsonBody(req);
  const request = updatePublicProfileRequestSchema.safeParse(body);

  if (!request.success) {
    return createValidationErrorResponse(request.error);
  }

  try {
    const pullRequest = await upsertPublicProfilePr(request.data);
    return Response.json({ success: true, pullRequest });
  } catch (error) {
    if (error instanceof PublicProfileRequestError) {
      return Response.json(
        { message: error.message, code: 'public_profile_conflict' },
        { status: error.status }
      );
    }
    throw error;
  }
}

export async function handleSubmitPublicProfileOperation(
  req: Request,
  env: GithubAppEnv
): Promise<Response> {
  const body = await readJsonBody(req);
  const parsed = submitPublicProfileOperationRequestSchema.safeParse(body);
  if (!parsed.success) return createValidationErrorResponse(parsed.error);

  const executor = createOperationExecutor(env, {
    [PROFILE_UPSERT_ACTION]: createProfileOperationHandler(
      createProfileDraftRepository()
    ),
  });
  let operation: OperationRecord;
  try {
    operation = await executor.submit(
      createProfileOperationCommand(parsed.data)
    );
  } catch (error) {
    if (error instanceof OperationIdempotencyConflictError) {
      return Response.json(
        ApiErrorEnvelopeSchema.parse({
          version: 1,
          error: {
            code: 'idempotency_conflict',
            message: 'The idempotency key was already used for another input',
            correlationId: parsed.data.correlationId,
            conflict: {
              resourceType: 'profile',
              resourceId: parsed.data.request.username,
            },
          },
        }),
        { status: 409 }
      );
    }
    throw error;
  }
  return Response.json(
    MutationAcceptedSchema.parse({
      version: 1,
      operationId: operation.operationId,
      status: operation.status === 'running' ? 'running' : 'queued',
      statusUrl: `/api/operations/${operation.operationId}`,
      retryAfterMs: 500,
    }),
    { status: 202 }
  );
}

export async function handleDiscardPublicProfilePr(
  req: Request
): Promise<Response> {
  const body = await readJsonBody(req);
  const request = discardPublicProfilePrRequestSchema.safeParse(body);

  if (!request.success) {
    return createValidationErrorResponse(request.error);
  }

  try {
    return Response.json(await discardPublicProfilePr(request.data));
  } catch (error) {
    if (error instanceof PublicProfileRequestError) {
      return Response.json(
        { message: error.message, code: 'public_profile_conflict' },
        { status: error.status }
      );
    }
    throw error;
  }
}
