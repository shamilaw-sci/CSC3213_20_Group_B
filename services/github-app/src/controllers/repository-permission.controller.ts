import { updateRepositoryPermission } from '@/repositories/user.repo';
import { updateRepositoryPermissionRequestSchema } from '@/schemas/request.schema';
import { createValidationErrorResponse, readJsonBody } from '@/utils/request';

/**
 * Handles repository permission grants and removals for a user config file.
 *
 * The upstream API must verify the real actor and pass that verified identity
 * in `updatedBy`; this service records it in the permission metadata and PR.
 */
export async function handleUpdateRepositoryPermission(req: Request) {
  const body = await readJsonBody(req);
  const request = updateRepositoryPermissionRequestSchema.safeParse(body);

  if (!request.success) {
    return createValidationErrorResponse(request.error);
  }

  const automation = await updateRepositoryPermission({
    repository: request.data.repository,
    username: request.data.username,
    permission: request.data.permission,
    active: request.data.active,
    updatedBy: request.data.updatedBy,
  });

  return Response.json({ success: true, automation });
}
