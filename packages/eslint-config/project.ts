import type { Settings } from 'eslint-plugin-better-tailwindcss/api/types';

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
