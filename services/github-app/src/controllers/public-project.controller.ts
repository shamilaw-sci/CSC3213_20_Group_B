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
  updatePublicProjectRequestSchema,
} from '@/schemas/request.schema';
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
