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
