import { ApiErrorEnvelopeSchema, MutationAcceptedSchema } from '@scs/schemas';

import {
  createProjectOperationCommand,
  createProjectOperationHandlers,
} from '@/domains/projects/project.operation';
import { createProjectDraftRepository } from '@/domains/projects/project.repository';
import { createOperationExecutor } from '@/operations/queue.consumer';
import { OperationIdempotencyConflictError } from '@/operations/operation.executor';
import type { OperationRecord } from '@/operations/operation.types';
import {
  deletePublicProjectPr,
  getPublicProject,
  getPublicProjectPrStatus,
  listPublicProjects,
  PublicProjectConflictError,
  upsertPublicProjectPr,
} from '@/repositories/public-project.repo';
import {
  deletePublicProjectRequestSchema,
  getPublicProjectQuerySchema,
  submitPublicProjectOperationRequestSchema,
  updatePublicProjectRequestSchema,
} from '@/schemas/request.schema';
import type { GithubAppEnv } from '@/types/env';
import { createValidationErrorResponse, readJsonBody } from '@/utils/request';

export async function handleGetPublicProject(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const query = getPublicProjectQuerySchema.safeParse({
    slug: url.searchParams.get('slug'),
  });

  if (!query.success) {
    return createValidationErrorResponse(query.error);
  }

  const result = await getPublicProject(query.data.slug);
  if (!result) {
    return Response.json({ project: null }, { status: 404 });
  }

  return Response.json(result);
}

export async function handleListPublicProjects(): Promise<Response> {
  return Response.json(await listPublicProjects());
}

export async function handleGetPublicProjectPrStatus(
  req: Request
): Promise<Response> {
  const url = new URL(req.url);
  const query = getPublicProjectQuerySchema.safeParse({
    slug: url.searchParams.get('slug'),
  });

  if (!query.success) {
    return createValidationErrorResponse(query.error);
  }

  return Response.json(await getPublicProjectPrStatus(query.data.slug));
}

export async function handleUpsertPublicProjectPr(
  req: Request
): Promise<Response> {
  const body = await readJsonBody(req);
  const request = updatePublicProjectRequestSchema.safeParse(body);

  if (!request.success) {
    return createValidationErrorResponse(request.error);
  }

  try {
    const pullRequest = await upsertPublicProjectPr(request.data);
    return Response.json({ success: true, pullRequest });
  } catch (error) {
    if (error instanceof PublicProjectConflictError) {
      return Response.json(
        { success: false, message: error.message, code: 'project_pr_conflict' },
        { status: error.status }
      );
    }
    throw error;
  }
}

export async function handleDeletePublicProjectPr(
  req: Request
): Promise<Response> {
  const body = await readJsonBody(req);
  const request = deletePublicProjectRequestSchema.safeParse(body);

  if (!request.success) {
    return createValidationErrorResponse(request.error);
  }

  try {
    const pullRequest = await deletePublicProjectPr({
      ...request.data,
      updatedByType: 'admin',
    });
    return Response.json({ success: true, pullRequest });
  } catch (error) {
    if (error instanceof PublicProjectConflictError) {
      return Response.json(
        { success: false, message: error.message, code: 'project_pr_conflict' },
        { status: error.status }
      );
    }
    throw error;
  }
}

export async function handleSubmitPublicProjectOperation(
  req: Request,
  env: GithubAppEnv
): Promise<Response> {
  const body = await readJsonBody(req);
  const parsed = submitPublicProjectOperationRequestSchema.safeParse(body);
  if (!parsed.success) return createValidationErrorResponse(parsed.error);

  const repository = createProjectDraftRepository();
  const executor = createOperationExecutor(
    env,
    createProjectOperationHandlers(repository)
  );
  const request = {
    action: parsed.data.action,
    slug: parsed.data.request.slug,
    updatedBy: parsed.data.request.updatedBy,
    projectPath: parsed.data.request.projectPath,
    expectedRevision: parsed.data.request.expectedRevision,
    ...(parsed.data.action === 'upsert'
      ? { project: parsed.data.request.project }
      : {}),
  };
  let operation: OperationRecord;
  try {
    operation = await executor.submit(
      createProjectOperationCommand({
        request,
        actorSubjectId: parsed.data.actorSubjectId,
        idempotencyKey: parsed.data.idempotencyKey,
        correlationId: parsed.data.correlationId,
      })
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
              resourceType: 'project',
              resourceId: parsed.data.request.slug,
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
