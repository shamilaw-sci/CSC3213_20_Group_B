import { getSecurityTxtRedirectTarget } from '@scs/security';

import type { Env } from '@/types/env';
import { createAuth, isBetterAuthRequest } from '@/auth/auth';
import { handleWorkerRequest } from '@/middleware/request-guards';
import { dispatchRoute } from '@/routes';
import { bindExecutionContext } from '@/runtime/request-context';

export default {
  async fetch(
    req: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    bindExecutionContext(req, ctx);
    return handleApiRequest(req, env);
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
      return createAuth(request, workerEnv).handler(request);
    }
    return dispatchRoute(request, workerEnv);
  });
}
