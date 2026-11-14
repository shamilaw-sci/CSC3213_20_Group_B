import { existsSync } from 'node:fs';

import type { Settings } from 'eslint-plugin-better-tailwindcss/api/types';
import tseslint from 'typescript-eslint';

export function projectDirectory(moduleUrl: string): string {
  const url = new URL('.', moduleUrl);
  if (url.protocol !== 'file:') throw new Error('Expected a file URL');
  const path = decodeURIComponent(url.pathname);
  const platformPath = url.host
    ? `//${url.host}${path}`
    : /^\/[A-Za-z]:\//.test(path)
      ? path.slice(1)
      : path;
  return platformPath.length > 1
    ? platformPath.replace(/\/$/, '')
    : platformPath;
}

export function typescriptProjectRoot(tsconfigRootDir: string) {
  const root = tsconfigRootDir.replaceAll('\\', '/');
  const tsconfigProject = `${root}/tsconfig.json`;
  const projects = [
    'tsconfig.json',
    'tsconfig.worker.json',
    'tsconfig.build.json',
    'tsconfig.test.json',
    'tsconfig.eslint.json',
    'tests/tsconfig.json',
    'scripts/tsconfig.json',
  ]
    .map((path) => `${root}/${path}`)
    .filter((path) => existsSync(path));

  return {
    files: ['{src,test,tests,k6,scripts}/**/*.{ts,tsx,mts,cts}'],
    linterOptions: {
      reportUnusedDisableDirectives: 'error' as const,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: projects,
        projectService: false,
        tsconfigRootDir,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      '@typescript-eslint/no-deprecated': 'error',
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: [tsconfigProject],
        },
      },
    },
  };
}

export function tailwindProjectRoot(cwd: string, entryPoint: string) {
  const settings = {
    cwd,
    detectComponentClasses: true,
    entryPoint,
  } satisfies Settings;

  return {
    settings: {
      'better-tailwindcss': settings,
    },
  };
}
