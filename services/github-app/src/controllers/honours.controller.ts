import {
  ApiErrorEnvelopeSchema,
  MutationAcceptedSchema,
  SubmitHonoursBulkOperationSchema,
} from '@scs/schemas';

import {
  createHonoursBulkCommand,
  createHonoursBulkHandler,
  HONOURS_BULK_ACTION,
} from '@/domains/honours/honours.operation';
import { createHonoursBulkRepository } from '@/domains/honours/honours.repository';
import { createOperationExecutor } from '@/operations/queue.consumer';
import { OperationIdempotencyConflictError } from '@/operations/operation.executor';
import type { GithubAppEnv } from '@/types/env';
import { createValidationErrorResponse, readJsonBody } from '@/utils/request';

export async function handleSubmitHonoursBulkOperation(
  req: Request,
  env: GithubAppEnv
): Promise<Response> {
  const parsed = SubmitHonoursBulkOperationSchema.safeParse(
    await readJsonBody(req)
  );
  if (!parsed.success) return createValidationErrorResponse(parsed.error);
  const executor = createOperationExecutor(env, {
    [HONOURS_BULK_ACTION]: createHonoursBulkHandler(
      createHonoursBulkRepository()
    ),
  });
  try {
    const operation = await executor.submit(
      createHonoursBulkCommand(parsed.data)
    );
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
  } catch (error) {
    if (error instanceof OperationIdempotencyConflictError) {
      return Response.json(
        ApiErrorEnvelopeSchema.parse({
          version: 1,
          error: {
            code: 'idempotency_conflict',
            message: 'The idempotency key was already used for another input',
            correlationId: parsed.data.correlationId,
          },
        }),
        { status: 409 }
      );
    }
    throw error;
  }
}
