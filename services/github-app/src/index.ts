import app from '@/app';
import {
  parseRuntimeConfig,
  RuntimeConfigurationError,
  runWithRuntimeConfig,
} from '@/config/runtime.config';
import type { GithubAppEnv } from '@/types/env';

type AppExecutionContext = Parameters<typeof app.fetch>[2];

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
};

export default worker;
