import { ApiErrorEnvelopeSchema, MutationAcceptedSchema } from '@scs/schemas';
import {
  deletePublicCourseOfferingRequestSchema,
  deletePublicCourseRequestSchema,
  getPublicAcademicRecordQuerySchema,
  submitPublicAcademicOperationRequestSchema,
  updatePublicCourseOfferingRequestSchema,
  updatePublicCourseRequestSchema,
} from '@scs/schemas';

import {
  createAcademicOperationCommand,
  createAcademicOperationHandlers,
} from '@/domains/academics/academic.operation';
import { createAcademicDraftRepository } from '@/domains/academics/academic.repository';
import { createOperationExecutor } from '@/operations/queue.consumer';
import { OperationIdempotencyConflictError } from '@/operations/operation.executor';
import type { OperationRecord } from '@/operations/operation.types';
import {
  deletePublicAcademicPr,
  getPublicAcademicPrStatus,
  getPublicAcademicRecord,
  listPublicAcademicRecords,
  PublicAcademicConflictError,
  upsertPublicAcademicPr,
} from '@/repositories/public-course.repo';
import type { GithubAppEnv } from '@/types/env';
import { createValidationErrorResponse, readJsonBody } from '@/utils/request';

export async function handleListPublicCourses(): Promise<Response> {
  return Response.json(await listPublicAcademicRecords('course'));
}

export async function handleGetPublicCourse(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const query = getPublicAcademicRecordQuerySchema.safeParse({
    id: url.searchParams.get('id'),
  });

  if (!query.success) {
    return createValidationErrorResponse(query.error);
  }

  const result = await getPublicAcademicRecord('course', query.data.id);
  if (!result) {
    return Response.json({ record: null }, { status: 404 });
  }

  return Response.json(result);
}

export async function handleGetPublicCoursePrStatus(
  req: Request
): Promise<Response> {
  const url = new URL(req.url);
  const query = getPublicAcademicRecordQuerySchema.safeParse({
    id: url.searchParams.get('id'),
  });

  if (!query.success) {
    return createValidationErrorResponse(query.error);
  }

  return Response.json(
    await getPublicAcademicPrStatus('course', query.data.id)
  );
}

export async function handleUpsertPublicCoursePr(
  req: Request
): Promise<Response> {
  const body = await readJsonBody(req);
  const request = updatePublicCourseRequestSchema.safeParse(body);

  if (!request.success) {
    return createValidationErrorResponse(request.error);
  }

  try {
    const pullRequest = await upsertPublicAcademicPr({
      kind: 'course',
      id: request.data.id,
      updatedBy: request.data.updatedBy,
      recordPath: request.data.recordPath,
      aggregatePath: request.data.aggregatePath,
      record: request.data.course,
      expectedHeadSha: request.data.expectedHeadSha,
    });
    return Response.json({ success: true, pullRequest });
  } catch (error) {
    if (error instanceof PublicAcademicConflictError) {
      return Response.json(
        { success: false, message: error.message, code: 'course_pr_conflict' },
        { status: error.status }
      );
    }
    throw error;
  }
}

export async function handleDeletePublicCoursePr(
  req: Request
): Promise<Response> {
  const body = await readJsonBody(req);
  const request = deletePublicCourseRequestSchema.safeParse(body);

  if (!request.success) {
    return createValidationErrorResponse(request.error);
  }

  try {
    const pullRequest = await deletePublicAcademicPr({
      kind: 'course',
      id: request.data.id,
      updatedBy: request.data.updatedBy,
      recordPath: request.data.recordPath,
      aggregatePath: request.data.aggregatePath,
      expectedHeadSha: request.data.expectedHeadSha,
    });
    return Response.json({ success: true, pullRequest });
  } catch (error) {
    if (error instanceof PublicAcademicConflictError) {
      return Response.json(
        { success: false, message: error.message, code: 'course_pr_conflict' },
        { status: error.status }
      );
    }
    throw error;
  }
}

export async function handleListPublicCourseOfferings(): Promise<Response> {
  return Response.json(await listPublicAcademicRecords('offering'));
}

export async function handleGetPublicCourseOffering(
  req: Request
): Promise<Response> {
  const url = new URL(req.url);
  const query = getPublicAcademicRecordQuerySchema.safeParse({
    id: url.searchParams.get('id'),
  });

  if (!query.success) {
    return createValidationErrorResponse(query.error);
  }

  const result = await getPublicAcademicRecord('offering', query.data.id);
  if (!result) {
    return Response.json({ record: null }, { status: 404 });
  }

  return Response.json(result);
}

export async function handleGetPublicCourseOfferingPrStatus(
  req: Request
): Promise<Response> {
  const url = new URL(req.url);
  const query = getPublicAcademicRecordQuerySchema.safeParse({
    id: url.searchParams.get('id'),
  });

  if (!query.success) {
    return createValidationErrorResponse(query.error);
  }

  return Response.json(
    await getPublicAcademicPrStatus('offering', query.data.id)
  );
}

export async function handleUpsertPublicCourseOfferingPr(
  req: Request
): Promise<Response> {
  const body = await readJsonBody(req);
  const request = updatePublicCourseOfferingRequestSchema.safeParse(body);

  if (!request.success) {
    return createValidationErrorResponse(request.error);
  }

  try {
    const pullRequest = await upsertPublicAcademicPr({
      kind: 'offering',
      id: request.data.id,
      updatedBy: request.data.updatedBy,
      recordPath: request.data.recordPath,
      aggregatePath: request.data.aggregatePath,
      record: request.data.offering,
      expectedHeadSha: request.data.expectedHeadSha,
    });
    return Response.json({ success: true, pullRequest });
  } catch (error) {
    if (error instanceof PublicAcademicConflictError) {
      return Response.json(
        {
          success: false,
          message: error.message,
          code: 'course_offering_pr_conflict',
        },
        { status: error.status }
      );
    }
    throw error;
  }
}

export async function handleDeletePublicCourseOfferingPr(
  req: Request
): Promise<Response> {
  const body = await readJsonBody(req);
  const request = deletePublicCourseOfferingRequestSchema.safeParse(body);

  if (!request.success) {
    return createValidationErrorResponse(request.error);
  }

  try {
    const pullRequest = await deletePublicAcademicPr({
      kind: 'offering',
      id: request.data.id,
      updatedBy: request.data.updatedBy,
      recordPath: request.data.recordPath,
      aggregatePath: request.data.aggregatePath,
      expectedHeadSha: request.data.expectedHeadSha,
    });
    return Response.json({ success: true, pullRequest });
  } catch (error) {
    if (error instanceof PublicAcademicConflictError) {
      return Response.json(
        {
          success: false,
          message: error.message,
          code: 'course_offering_pr_conflict',
        },
        { status: error.status }
      );
    }
    throw error;
  }
}

export async function handleSubmitPublicAcademicOperation(
  req: Request,
  env: GithubAppEnv
): Promise<Response> {
  const body = await readJsonBody(req);
  const parsed = submitPublicAcademicOperationRequestSchema.safeParse(body);
  if (!parsed.success) return createValidationErrorResponse(parsed.error);

  const [kind, action] = parsed.data.operation.split('.') as [
    'course' | 'offering',
    'upsert' | 'delete',
  ];
  const source = parsed.data.request;
  const record =
    parsed.data.operation === 'course.upsert'
      ? parsed.data.request.course
      : parsed.data.operation === 'offering.upsert'
        ? parsed.data.request.offering
        : undefined;
  const request = {
    action,
    kind,
    id: source.id,
    updatedBy: source.updatedBy,
    recordPath: source.recordPath,
    expectedRevision: source.expectedRevision,
    ...(record ? { record } : {}),
  };
  const executor = createOperationExecutor(
    env,
    createAcademicOperationHandlers(createAcademicDraftRepository())
  );
  let operation: OperationRecord;
  try {
    operation = await executor.submit(
      createAcademicOperationCommand({
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
              resourceType: kind,
              resourceId: source.id,
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
