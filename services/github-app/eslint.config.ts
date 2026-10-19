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
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        projectService: false,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['src/index.ts', 'src/operations/*.object.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.worker.json'],
        projectService: false,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Cloudflare exposes this runtime module virtually; TypeScript validates it
      // through @cloudflare/workers-types in the worker project.
      'import/no-unresolved': 'off',
    },
  },
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
