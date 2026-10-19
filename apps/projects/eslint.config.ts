import nextConfig from '@scs/eslint-config/next';
import { typescriptProjectRoot } from '@scs/eslint-config/project';
import { globalIgnores } from 'eslint/config';

const config = [
  ...nextConfig,
  typescriptProjectRoot(import.meta.dirname),
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
