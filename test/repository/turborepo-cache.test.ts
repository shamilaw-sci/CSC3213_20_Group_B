import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

interface TurboConfig {
  cacheMaxAge?: string;
  cacheMaxSize?: string;
  tasks: {
    build?: { outputs?: string[] };
    dev?: { cache?: boolean; persistent?: boolean };
  };
}

const turbo = JSON.parse(readFileSync('turbo.json', 'utf8')) as TurboConfig;

describe('Turborepo cache policy', () => {
  test('bounds the local cache by age and size', () => {
    expect(turbo.cacheMaxAge).toBe('7d');
    expect(turbo.cacheMaxSize).toBe('2GB');
  });

  test('caches production builds without framework regeneration caches', () => {
    expect(turbo.tasks.build?.outputs).toEqual([
      '.next/**',
      '!.next/cache/**',
      '!.next/dev/**',
      'dist/**',
    ]);
  });

  test('does not cache the persistent development task', () => {
    expect(turbo.tasks.dev).toMatchObject({
      cache: false,
      persistent: true,
    });
  });
});
