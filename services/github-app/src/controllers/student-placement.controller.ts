import {
  discardStudentPlacementMetadataRequestSchema,
  updateStudentPlacementMetadataRequestSchema,
} from '@scs/schemas';

import {
  discardStudentPlacementPrs,
  getStudentPlacementPrStatus,
  upsertStudentPlacementPr,
} from '@/repositories/student-placement.repo';
import { createValidationErrorResponse, readJsonBody } from '@/utils/request';

export async function handleGetStudentPlacementPrStatus(): Promise<Response> {
  const pullRequest = await getStudentPlacementPrStatus();
  return Response.json({ success: true, pullRequest });
}

export async function handleUpsertStudentPlacementPr(
  req: Request
): Promise<Response> {
  const body = await readJsonBody(req);
  const request = updateStudentPlacementMetadataRequestSchema.safeParse(body);

  if (!request.success) {
    return createValidationErrorResponse(request.error);
  }

  const pullRequest = await upsertStudentPlacementPr(request.data);
  return Response.json({ success: true, pullRequest });
}

export async function handleDiscardStudentPlacementPrs(
  req: Request
): Promise<Response> {
  const body = await readJsonBody(req);
  const request = discardStudentPlacementMetadataRequestSchema.safeParse(body);

  if (!request.success) {
    return createValidationErrorResponse(request.error);
  }

  const cleanup = await discardStudentPlacementPrs(request.data.updatedBy);
  return Response.json({ success: true, cleanup });
}
