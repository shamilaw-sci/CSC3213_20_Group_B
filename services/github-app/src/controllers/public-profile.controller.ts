import {
  getPublicProfile,
  getPublicProfilePrStatus,
  discardPublicProfilePr,
  PublicProfileRequestError,
  upsertPublicProfilePr,
} from '@/repositories/public-profile.repo';
import {
  discardPublicProfilePrRequestSchema,
  getPublicProfileQuerySchema,
  updatePublicProfileRequestSchema,
} from '@/schemas/request.schema';
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
