export function typescriptProjectRoot(tsconfigRootDir: string) {
  return {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir,
      },
    },
  };
}
