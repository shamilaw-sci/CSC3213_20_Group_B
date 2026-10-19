import app from '@/app';
import {
  parseRuntimeConfig,
  RuntimeConfigurationError,
  runWithRuntimeConfig,
} from '@/config/runtime.config';
import type { GithubAppEnv } from '@/types/env';
import type { OperationQueueBatch } from '@/operations/cloudflare.types';
import { MutationCoordinatorDurableObject } from '@/operations/mutation-coordinator.object';
import { OperationStateDurableObject } from '@/operations/operation-state.object';
import { consumeOperationBatch } from '@/operations/queue.consumer';
import type { OperationHandler } from '@/operations/operation.types';

type AppExecutionContext = Parameters<typeof app.fetch>[2];
const operationHandlers: Record<string, OperationHandler> = {};

const worker = {
  async fetch(
    request: Request,
    env: GithubAppEnv,
    executionContext: AppExecutionContext
  ): Promise<Response> {
    try {
      const config = parseRuntimeConfig(env);
      return await runWithRuntimeConfig(config, () =>
        app.fetch(request, env, executionContext)
      );
    } catch (error) {
      const fields =
        error instanceof RuntimeConfigurationError ? error.fields : [];
      return Response.json(
        {
          code: 'runtime_config_invalid',
          error: 'GitHub App runtime configuration is invalid',
          ...(fields.length > 0 ? { fields } : {}),
        },
        { status: 500 }
      );
    }
  },
  async queue(batch: OperationQueueBatch, env: GithubAppEnv): Promise<void> {
    const config = parseRuntimeConfig(env);
    await runWithRuntimeConfig(config, () =>
      consumeOperationBatch(batch, env, operationHandlers)
    );
  },
};

export { MutationCoordinatorDurableObject, OperationStateDurableObject };
export default worker;
