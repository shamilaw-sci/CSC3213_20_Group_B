import base from '@scs/eslint-config/base';
import { typescriptProjectRoot } from '@scs/eslint-config/project';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const config = [
  ...tseslint.configs.recommended,
  ...base,
  typescriptProjectRoot(import.meta.dirname),
  {
    files: ['**/*.{ts,js}'],
    languageOptions: { globals: { ...globals.bunBuiltin, ...globals.node } },
  },
  {
    files: ['k6/**/*.ts'],
    languageOptions: { globals: { __ENV: 'readonly', open: 'readonly' } },
  },
];

export default config;
