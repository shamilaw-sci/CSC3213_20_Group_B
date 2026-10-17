import {
  deletePublicAcademicPr,
  getPublicAcademicPrStatus,
  getPublicAcademicRecord,
  listPublicAcademicRecords,
  publicAcademicPaths,
  PublicAcademicConflictError,
  upsertPublicAcademicPr,
} from '@/repositories/public-course.repo';
import {
  deletePublicCourseOfferingRequestSchema,
  deletePublicCourseRequestSchema,
  getPublicAcademicRecordQuerySchema,
  updatePublicCourseOfferingRequestSchema,
  updatePublicCourseRequestSchema,
} from '@/schemas/request.schema';
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

export function academicRegistryPaths() {
  return publicAcademicPaths;
}
