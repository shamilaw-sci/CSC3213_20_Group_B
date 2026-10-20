import { createHash } from 'node:crypto';

import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';

import { getRuntimeConfig } from '@/config/runtime.config';

let cachedClient: { fingerprint: string; octokit: Octokit } | undefined;

function credentialFingerprint(input: {
  appId: string;
  installationId: string;
  privateKey: string;
}): string {
  return createHash('sha256')
    .update(input.appId)
    .update('\0')
    .update(input.installationId)
    .update('\0')
    .update(input.privateKey)
    .digest('hex');
}

/**
 * Cache only while the complete credential fingerprint matches the current
 * request context; local tests may run different runtime configs concurrently.
 */
export function getOctokit() {
  const envConfig = getRuntimeConfig();
  const credentials = {
    appId: envConfig.GITHUB_APP_ID,
    privateKey: envConfig.GITHUB_PRIVATE_KEY,
    installationId: envConfig.GITHUB_INSTALLATION_ID,
  };
  const fingerprint = credentialFingerprint(credentials);
  if (cachedClient?.fingerprint === fingerprint) return cachedClient.octokit;

  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: credentials,
  });
  cachedClient = { fingerprint, octokit };
  return octokit;
}
