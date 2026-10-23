import type { Settings } from 'eslint-plugin-better-tailwindcss/api/types';

export function typescriptProjectRoot(tsconfigRootDir: string) {
  const tsconfigProject = `${tsconfigRootDir.replaceAll('\\', '/')}/tsconfig.json`;

  return {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir,
      },
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
