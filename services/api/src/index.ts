import type { Env } from '@/types/env';
import { handleWorkerRequest } from '@/middleware/request-guards';
import { dispatchRoute } from '@/routes';

export default {
  async fetch(
    req: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    return handleWorkerRequest(req, env, async (request, workerEnv) => {
      void ctx;
      return dispatchRoute(request, workerEnv);
    });
  },
};
