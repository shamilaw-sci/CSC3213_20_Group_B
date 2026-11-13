import {
  projectDirectory,
  typescriptProjectRoot,
} from '@scs/eslint-config/project';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

const config = [
  typescriptProjectRoot(projectDirectory(import.meta.url)),
  {
    files: ['src/**/*.ts', 'tests/**/*.tsx'],
    languageOptions: { parser: tseslint.parser },
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
];

export default config;
