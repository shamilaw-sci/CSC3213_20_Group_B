import { getSecurityTxtRedirectTarget } from '@scs/security';

import type { Env } from '@/types/env';
import { createAuth, isBetterAuthRequest } from '@/auth/auth';
import { handleWorkerRequest } from '@/middleware/request-guards';
import { dispatchRoute } from '@/routes';
import { bindExecutionContext } from '@/runtime/request-context';
import { reconcileDueHonoursIntents } from '@/services/honours.service';

export default {
  async fetch(
    req: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    bindExecutionContext(req, ctx);
    return handleApiRequest(req, env);
  },
  scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): void {
    ctx.waitUntil(reconcileDueHonoursIntents(env));
  },
};

export async function handleApiRequest(
  req: Request,
  env: Env
): Promise<Response> {
  const securityTxtRedirect = getSecurityTxtRedirectTarget(req);
  if (securityTxtRedirect) {
    return new Response(null, {
      status: 308,
      headers: { Location: securityTxtRedirect },
    });
  }

  return handleWorkerRequest(req, env, async (request, workerEnv) => {
    if (isBetterAuthRequest(request)) {
      if (
        request.method === 'POST' &&
        new URL(request.url).pathname === '/api/auth/unlink-account'
      ) {
        const body: unknown = await request
          .clone()
          .json()
          .catch(() => null);
        if (
          body &&
          typeof body === 'object' &&
          'providerId' in body &&
          body.providerId === 'orcid'
        ) {
          return Response.json(
            { error: 'Use the ORCID connection controls to disconnect' },
            { status: 403 }
          );
        }
      }
      return createAuth(request, workerEnv).handler(request);
    }
    return dispatchRoute(request, workerEnv);
  });
}
