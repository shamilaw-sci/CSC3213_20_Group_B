import { describe, expect, test } from 'bun:test';

import {
  getRuntimeConfig,
  parseRuntimeConfig,
  runWithRuntimeConfig,
} from '@/config/runtime.config';
import { secureSecretEqual } from '@/middleware/auth';
import type { GithubAppEnv } from '@/types/env';

const validBindings = {
  GITHUB_APP_ID: '123',
  GITHUB_PRIVATE_KEY: 'private-key',
  GITHUB_INSTALLATION_ID: '456',
  GITHUB_OWNER: 'scs-pdn',
  GITHUB_CONFIG_REPOSITORY: 'config.scs.pdn.ac.lk',
  GITHUB_PEOPLE_DATA_REPOSITORY: 'data.scs.pdn.ac.lk',
  GITHUB_PROJECTS_DATA_REPOSITORY: 'data.scs.pdn.ac.lk',
  X_INTERNAL_SECRET: 'internal-secret',
  PORT: '3000',
} satisfies GithubAppEnv;

describe('GitHub App runtime configuration', () => {
  test('validates and normalizes adapter bindings', () => {
    expect(parseRuntimeConfig(validBindings)).toEqual({
      ...validBindings,
      PORT: 3000,
    });
  });

  test('reports missing field names without including secret values', () => {
    expect(() =>
      parseRuntimeConfig({ ...validBindings, GITHUB_PRIVATE_KEY: '' })
    ).toThrow('GITHUB_PRIVATE_KEY');

    try {
      parseRuntimeConfig({
        ...validBindings,
        GITHUB_PRIVATE_KEY: 'do-not-log-this-value',
        PORT: 'invalid',
      });
    } catch (error) {
      expect(String(error)).not.toContain('do-not-log-this-value');
    }
  });

  test('isolates concurrent request configurations', async () => {
    const first = parseRuntimeConfig(validBindings);
    const second = parseRuntimeConfig({
      ...validBindings,
      GITHUB_OWNER: 'other-owner',
    });

    const [firstOwner, secondOwner] = await Promise.all([
      runWithRuntimeConfig(first, async () => {
        await Promise.resolve();
        return getRuntimeConfig().GITHUB_OWNER;
      }),
      runWithRuntimeConfig(second, async () => {
        await Promise.resolve();
        return getRuntimeConfig().GITHUB_OWNER;
      }),
    ]);

    expect(firstOwner).toBe('scs-pdn');
    expect(secondOwner).toBe('other-owner');
  });

  test('compares internal secrets without a length-based early exit', () => {
    expect(secureSecretEqual('internal-secret', 'internal-secret')).toBe(true);
    expect(secureSecretEqual('short', 'a-different-length-secret')).toBe(false);
  });
});
