import { typescriptProjectRoot } from '@scs/eslint-config/project';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

const importSortRules = {
  'simple-import-sort/exports': 'error',
  'simple-import-sort/imports': 'error',
};

const config = [
  typescriptProjectRoot(import.meta.dirname),
  {
    ignores: ['dist/**', 'coverage/**'],
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        sourceType: 'module',
      },
    },
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: importSortRules,
  },
];

export default config;
