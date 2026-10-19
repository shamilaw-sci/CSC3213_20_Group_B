import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

import app from '@/app';
import {
  parseRuntimeConfig,
  runWithRuntimeConfig,
} from '@/config/runtime.config';
import type { GithubAppEnv } from '@/types/env';

const processEnv = createEnv({
  server: {
    GITHUB_APP_ID: z.string().min(1),
    GITHUB_PRIVATE_KEY: z.string().min(1),
    GITHUB_INSTALLATION_ID: z.string().min(1),
    GITHUB_OWNER: z.string().min(1),
    GITHUB_CONFIG_REPOSITORY: z.string().min(1),
    GITHUB_PEOPLE_DATA_REPOSITORY: z.string().min(1),
    GITHUB_PROJECTS_DATA_REPOSITORY: z.string().min(1),
    X_INTERNAL_SECRET: z.string().min(1),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

const bindings: GithubAppEnv = processEnv;
const runtimeConfig = parseRuntimeConfig(bindings);

/**
 * Starts the Hono app on Bun's native HTTP server.
 */
Bun.serve({
  port: runtimeConfig.PORT,
  fetch: (request) =>
    runWithRuntimeConfig(runtimeConfig, () => app.fetch(request, bindings)),
});

console.log(`Listening on http://localhost:${runtimeConfig.PORT}`);
