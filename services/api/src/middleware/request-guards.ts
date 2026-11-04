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

const AVATAR_ORIGINS = new Set([
  'https://people.scs-pdn.space',
  'https://people.scs.pdn.ac.lk',
  'https://people.scs-pdn.localhost',
]);

function isPeopleAvatarRequest(req: Request, origin: string): boolean {
  return (
    AVATAR_ORIGINS.has(origin) &&
    new URL(req.url).pathname.startsWith('/api/people/v2/avatars/')
  );
}

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
    if (isAllowedOrigin(origin) || isPeopleAvatarRequest(req, origin)) {
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
