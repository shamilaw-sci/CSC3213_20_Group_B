import { typescriptProjectRoot } from '@scs/eslint-config/project';
import workerConfig from '@scs/eslint-config/worker';
import { globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const config = [
  globalIgnores(['node_modules', 'dist', 'eslint.config.ts']),
  ...workerConfig,
  typescriptProjectRoot(import.meta.dirname),
  {
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },
  {
    files: ['tests/**/*.ts'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      parser: tseslint.parser,
      globals: {
        ...globals.node,
      },
    },
  },
];

export default config;
