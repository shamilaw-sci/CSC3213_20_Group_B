import nextConfig from '@scs/eslint-config/next';
import { globalIgnores } from 'eslint/config';

const config = [
  ...nextConfig,
  globalIgnores([
    '.agents/**',
    '.devcontainer/**',
    '.husky/**',
    '.vscode/**',
    '.github/**',
    '.cache/**',
    '.next/**',
    'out/**',
    'build/**',
    'dist/**',
    'node_modules/**',
    'next-env.d.ts',
  ]),
];

export default config;
