import {
  getUserAccessConfig,
  updateUserProxySettings,
} from '@/repositories/user.repo';
import {
  getUserAccessConfigQuerySchema,
  updateProxySettingsRequestSchema,
} from '@/schemas/request.schema';
import { createValidationErrorResponse, readJsonBody } from '@/utils/request';

/**
 * Handles reads for a user's access config file.
 *
 * Returns a denied default config when the user file does not exist.
 */
export async function handleGetUserAccessConfig(req: Request) {
  const url = new URL(req.url);
  const query = getUserAccessConfigQuerySchema.safeParse({
    username: url.searchParams.get('username'),
  });

  if (!query.success) {
    return createValidationErrorResponse(query.error);
  }

  const config = await getUserAccessConfig(query.data.username);

  if (!config) {
    return Response.json({
      proxy: {
        active: false,
        url: '',
        availableAttempts: 5,
      },
      permissions: {
        repo: {},
      },
    });
  }

  return Response.json(config);
}

/**
 * Handles proxy setting updates for a user config file.
 *
 * The upstream API is responsible for verifying the real actor before sending
 * `updatedBy`; this service records that value in the config file and PR body.
 */
export async function handleUpdateProxySettings(req: Request) {
  const body = await readJsonBody(req);
  const request = updateProxySettingsRequestSchema.safeParse(body);

  if (!request.success) {
    return createValidationErrorResponse(request.error);
  }

  const automation = await updateUserProxySettings(
    request.data.username,
    request.data.email,
    request.data.updatedBy,
    {
      active: request.data.active,
      url: request.data.url,
      availableAttempts: request.data.availableAttempts,
    }
  );

  return Response.json({ success: true, automation });
}
