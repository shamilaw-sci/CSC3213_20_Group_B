import type { Env } from '@/types/env';
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
  req: Request
): Response {
  return attachCorsHeaders(response, getRequestOrigin(req));
}

export async function handleWorkerRequest(
  req: Request,
  env: Env,
  dispatch: WorkerHandler
): Promise<Response> {
  const origin = getRequestOrigin(req);

  if (req.method === 'OPTIONS') {
    if (isAllowedOrigin(origin)) {
      return createCorsPreflightResponse(origin);
    }

    return createJsonErrorResponse('Forbidden', 403, origin);
  }

  try {
    const response = await dispatch(req, env);
    if (response.status === 405) {
      return response;
    }
    return applyCorsHeadersToResponse(response, req);
  } catch (error: unknown) {
    console.error('Error handling request:', error);
    return createInternalServerErrorResponse(origin);
  }
}
