import { typescriptProjectRoot } from '@scs/eslint-config/project';
import workerConfig from '@scs/eslint-config/worker';
import { globalIgnores } from 'eslint/config';
import globals from 'globals';

const config = [
  globalIgnores(['node_modules', 'dist', 'eslint.config.ts']),
  ...workerConfig,
  typescriptProjectRoot(import.meta.dirname),
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
      globals: {
        ...globals.bunBuiltin,
        ...globals.node,
      },
    },
  },
];

export default config;
