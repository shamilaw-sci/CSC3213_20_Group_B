import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';

import { getRuntimeConfig } from '@/config/runtime.config';

/**
 * Creates an Octokit client authenticated as the configured GitHub App
 * installation.
 */
export function getOctokit() {
  const envConfig = getRuntimeConfig();
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: envConfig.GITHUB_APP_ID,
      privateKey: envConfig.GITHUB_PRIVATE_KEY,
      installationId: envConfig.GITHUB_INSTALLATION_ID,
    },
  });
}
