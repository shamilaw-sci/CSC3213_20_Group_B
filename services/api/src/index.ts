import type { Env } from '@/types/env';
import { createAuth, isBetterAuthRequest } from '@/auth/auth';
import { handleWorkerRequest } from '@/middleware/request-guards';
import { dispatchRoute } from '@/routes';

export default {
  async fetch(
    req: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    return handleWorkerRequest(req, env, async (request, workerEnv) => {
      if (isBetterAuthRequest(request)) {
        return createAuth(request, workerEnv, ctx).handler(request);
      }
      return dispatchRoute(request, workerEnv);
    });
  },
};
