import { describe, expect, test } from 'bun:test';

import baseConfig from '@scs/eslint-config/base';
import nextConfig from '@scs/eslint-config/next';
import { typescriptProjectRoot } from '@scs/eslint-config/project';
import workerConfig from '@scs/eslint-config/worker';
import projectsConfig from '../../../apps/projects/eslint.config';
import webConfig from '../../../apps/web/eslint.config';
import uiConfig from '../../ui/eslint.config';
import githubAppConfig from '../../../services/github-app/eslint.config';

type FlatConfig = {
  files?: string[];
  name?: string;
  languageOptions?: {
    parserOptions?: { project?: boolean; projectService?: boolean };
  };
  rules?: Record<string, unknown>;
  settings?: {
    'better-tailwindcss'?: {
      cwd?: string;
      detectComponentClasses?: boolean;
      entryPoint?: string;
    };
    'import/resolver'?: {
      typescript?: { project?: string[] };
    };
  };
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
    expect(rules['better-tailwindcss/no-unknown-classes']).toBe('error');
    expect(rules['better-tailwindcss/no-conflicting-classes']).toBe('error');
    expect(rules['better-tailwindcss/enforce-canonical-classes']).toBe('error');
    expect(rules['better-tailwindcss/enforce-consistent-class-order']).toBe(
      undefined
    );
    expect(postcssOverride?.rules?.['unused-imports/no-unused-vars']).toBe(
      'off'
    );
  });

  test('Tailwind consumers resolve their own CSS entry point', () => {
    const webSettings = (webConfig as FlatConfig[]).find(
      (entry) => entry.settings?.['better-tailwindcss']
    )?.settings?.['better-tailwindcss'];
    const uiSettings = (uiConfig as FlatConfig[]).find(
      (entry) => entry.settings?.['better-tailwindcss']
    )?.settings?.['better-tailwindcss'];

    expect(webSettings).toEqual({
      cwd: expect.stringMatching(/[\\/]apps[\\/]web$/),
      detectComponentClasses: true,
      entryPoint: 'src/app/globals.css',
    });
    expect(uiSettings).toEqual({
      cwd: expect.stringMatching(/[\\/]packages[\\/]ui$/),
      detectComponentClasses: true,
      entryPoint: 'src/styles/registry.css',
    });

    expect(
      mergedRules(uiConfig as FlatConfig[])[
        'better-tailwindcss/no-unknown-classes'
      ]
    ).toBe('off');

    expect(
      mergedRules(projectsConfig as FlatConfig[])[
        'better-tailwindcss/no-unknown-classes'
      ]
    ).toEqual([
      'error',
      {
        ignore: ['^loading-shimmer-page$', '^project-search-control$'],
      },
    ]);
  });

  test('Worker preserves security, import, and typed promise rules', () => {
    const rules = mergedRules(workerConfig as FlatConfig[]);

    expect(rules['security/detect-object-injection']).toBe('off');
    expect(rules['import/no-unresolved']).toBe('error');
    expect(rules['@typescript-eslint/no-floating-promises']).toBe('error');
    expect(rules['@typescript-eslint/no-misused-promises']).toBe('error');
  });

  test('workspace project roots pin import resolution to their TSConfig', () => {
    const config = typescriptProjectRoot(
      'C:\\workspace\\services\\github-app'
    ) as FlatConfig;

    expect(config.settings?.['import/resolver']?.typescript?.project).toEqual([
      'C:/workspace/services/github-app/tsconfig.json',
    ]);
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
