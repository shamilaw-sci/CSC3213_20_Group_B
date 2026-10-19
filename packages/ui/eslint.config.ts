import nextConfig from '@scs/eslint-config/next';
import { typescriptProjectRoot } from '@scs/eslint-config/project';
import { globalIgnores } from 'eslint/config';

const config = [
  ...nextConfig,
  typescriptProjectRoot(import.meta.dirname),
  {
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  globalIgnores(['node_modules/**']),
];

export default config;
