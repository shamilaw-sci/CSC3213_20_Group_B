import type { Env } from '@/types/env';
import { isIdentityMigrationMissing } from '@/repositories/migration-error';
import {
  attachCorsHeaders,
  createCorsPreflightResponse,
  createInternalServerErrorResponse,
  createJsonErrorResponse,
  getRequestOrigin,
  isAllowedOrigin,
} from '@/http/responses';

export type WorkerHandler = (req: Request, env: Env) => Promise<Response>;

function applyCorsHeadersToResponse(
  response: Response,
  req: Request,
  env: Env
): Response {
  return attachCorsHeaders(
    response,
    getRequestOrigin(req),
    env.ALLOWED_ORIGINS
  );
}

export async function handleWorkerRequest(
  req: Request,
  env: Env,
  dispatch: WorkerHandler
): Promise<Response> {
  const origin = getRequestOrigin(req);

  if (req.method === 'OPTIONS') {
    if (isAllowedOrigin(origin, env.ALLOWED_ORIGINS)) {
      return createCorsPreflightResponse(origin);
    }

    return attachCorsHeaders(
      createJsonErrorResponse('Forbidden', 403, origin),
      origin,
      env.ALLOWED_ORIGINS
    );
  }

  try {
    const response = await dispatch(req, env);
    if (response.status === 405) {
      return response;
    }
    return applyCorsHeadersToResponse(response, req, env);
  } catch (error: unknown) {
    console.error('Error handling request:', error);
    if (isIdentityMigrationMissing(error)) {
      return attachCorsHeaders(
        createJsonErrorResponse(
          'API database migration required; contact an operator',
          503,
          origin,
          'DATABASE_MIGRATION_REQUIRED'
        ),
        origin,
        env.ALLOWED_ORIGINS
      );
    }
    return attachCorsHeaders(
      createInternalServerErrorResponse(origin),
      origin,
      env.ALLOWED_ORIGINS
    );
  }
}
