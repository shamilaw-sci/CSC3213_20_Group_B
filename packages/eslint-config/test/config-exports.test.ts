import { describe, expect, test } from 'bun:test';

import baseConfig from '../base';
import nextConfig from '../next';
import workerConfig from '../worker';
import githubAppConfig from '../../../services/github-app/eslint.config';

type FlatConfig = {
  files?: string[];
  name?: string;
  languageOptions?: {
    parserOptions?: { project?: boolean; projectService?: boolean };
  };
  rules?: Record<string, unknown>;
};

function mergedRules(config: FlatConfig[]) {
  return Object.assign({}, ...config.map((entry) => entry.rules ?? {}));
}

describe('shared ESLint exports', () => {
  test('base preserves import sorting, unused-import removal, and Prettier', () => {
    const base = baseConfig as FlatConfig[];
    const rules = mergedRules(base);

    expect(rules['simple-import-sort/imports']).toBe('error');
    expect(rules['simple-import-sort/exports']).toBe('error');
    expect(rules['unused-imports/no-unused-imports']).toBe('error');
    expect(base.at(-1)?.rules?.semi).toBe('off');
  });

  test('Next preserves its recommended rule sets and shared base rules', () => {
    const config = nextConfig as FlatConfig[];
    const rules = mergedRules(config);
    const postcssOverride = config.find((entry) =>
      entry.files?.includes('postcss.config.mts')
    );

    expect(rules['@next/next/no-html-link-for-pages']).toBeDefined();
    expect(rules['@typescript-eslint/no-explicit-any']).toBe('warn');
    expect(rules['simple-import-sort/imports']).toBe('error');
    expect(postcssOverride?.rules?.['unused-imports/no-unused-vars']).toBe(
      'off'
    );
  });

  test('Worker preserves security, import, and typed promise rules', () => {
    const rules = mergedRules(workerConfig as FlatConfig[]);

    expect(rules['security/detect-object-injection']).toBe('off');
    expect(rules['import/no-unresolved']).toBe('error');
    expect(rules['@typescript-eslint/no-floating-promises']).toBe('error');
    expect(rules['@typescript-eslint/no-misused-promises']).toBe('error');
  });

  test('GitHub App tests retain the non-type-aware override', () => {
    const testOverride = (githubAppConfig as FlatConfig[]).find((entry) =>
      entry.files?.includes('tests/**/*.ts')
    );

    expect(testOverride).toBeDefined();
    expect(testOverride?.name).toBe('typescript-eslint/disable-type-checked');
    expect(
      testOverride?.rules?.['@typescript-eslint/no-floating-promises']
    ).toBe('off');
  });
});
