import { AsyncLocalStorage } from 'node:async_hooks';

import type { GithubAppEnv, GithubAppRuntimeConfig } from '@/types/env';

const REQUIRED_FIELDS = [
  'GITHUB_APP_ID',
  'GITHUB_PRIVATE_KEY',
  'GITHUB_INSTALLATION_ID',
  'GITHUB_OWNER',
  'GITHUB_PEOPLE_DATA_REPOSITORY',
  'GITHUB_PROJECTS_DATA_REPOSITORY',
  'X_INTERNAL_SECRET',
] as const satisfies readonly (keyof GithubAppEnv)[];

const runtimeStorage = new AsyncLocalStorage<GithubAppRuntimeConfig>();

export class RuntimeConfigurationError extends Error {
  constructor(public readonly fields: readonly string[]) {
    super(`Invalid runtime configuration: ${fields.join(', ')}`);
    this.name = 'RuntimeConfigurationError';
  }
}

export function parseRuntimeConfig(
  bindings: Partial<GithubAppEnv>
): GithubAppRuntimeConfig {
  const invalidFields: string[] = REQUIRED_FIELDS.filter((field) => {
    const value = bindings[field];
    return typeof value !== 'string' || value.trim().length === 0;
  });
  const port = Number(bindings.PORT ?? '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    invalidFields.push('PORT');
  }
  if (invalidFields.length > 0) {
    throw new RuntimeConfigurationError(invalidFields);
  }

  const required = (field: (typeof REQUIRED_FIELDS)[number]): string => {
    const value = bindings[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new RuntimeConfigurationError([field]);
    }
    return value;
  };

  return {
    GITHUB_APP_ID: required('GITHUB_APP_ID').trim(),
    GITHUB_PRIVATE_KEY: required('GITHUB_PRIVATE_KEY').replace(/\\n/g, '\n'),
    GITHUB_INSTALLATION_ID: required('GITHUB_INSTALLATION_ID').trim(),
    GITHUB_OWNER: required('GITHUB_OWNER').trim(),
    GITHUB_PEOPLE_DATA_REPOSITORY: required(
      'GITHUB_PEOPLE_DATA_REPOSITORY'
    ).trim(),
    GITHUB_PROJECTS_DATA_REPOSITORY: required(
      'GITHUB_PROJECTS_DATA_REPOSITORY'
    ).trim(),
    X_INTERNAL_SECRET: required('X_INTERNAL_SECRET'),
    PORT: port,
  };
}

export function runWithRuntimeConfig<T>(
  config: GithubAppRuntimeConfig,
  callback: () => T
): T {
  return runtimeStorage.run(config, callback);
}

export function getRuntimeConfig(): GithubAppRuntimeConfig {
  const config = runtimeStorage.getStore();
  if (!config) {
    throw new RuntimeConfigurationError(['request_context']);
  }
  return config;
}
