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
import {
  createProfileOperationHandler,
  PROFILE_UPSERT_ACTION,
} from '@/domains/profiles/profile.operation';
import { createProfileDraftRepository } from '@/domains/profiles/profile.repository';
import { createProjectOperationHandlers } from '@/domains/projects/project.operation';
import { createProjectDraftRepository } from '@/domains/projects/project.repository';

type AppExecutionContext = Parameters<typeof app.fetch>[2];

function operationHandlers(): Record<string, OperationHandler> {
  return {
    ...createProjectOperationHandlers(createProjectDraftRepository()),
    [PROFILE_UPSERT_ACTION]: createProfileOperationHandler(
      createProfileDraftRepository()
    ),
  };
}

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
      consumeOperationBatch(batch, env, operationHandlers())
    );
  },
};

export { MutationCoordinatorDurableObject, OperationStateDurableObject };
export default worker;
