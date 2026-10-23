import nextConfig from '@scs/eslint-config/next';
import {
  tailwindProjectRoot,
  typescriptProjectRoot,
} from '@scs/eslint-config/project';
import { globalIgnores } from 'eslint/config';

const config = [
  ...nextConfig,
  typescriptProjectRoot(import.meta.dirname),
  tailwindProjectRoot(import.meta.dirname, 'src/app/globals.css'),
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
