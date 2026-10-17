import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';

import envConfig from '@/config/env.config';

/**
 * Creates an Octokit client authenticated as the configured GitHub App
 * installation.
 */
export function getOctokit() {
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: envConfig.GITHUB_APP_ID,
      privateKey: envConfig.GITHUB_PRIVATE_KEY,
      installationId: envConfig.GITHUB_INSTALLATION_ID,
    },
  });
}
