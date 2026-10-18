import nextConfig from '@scs/eslint-config/next';
import { globalIgnores } from 'eslint/config';

const config = [
  ...nextConfig,
  {
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  globalIgnores(['node_modules/**']),
];

export default config;
