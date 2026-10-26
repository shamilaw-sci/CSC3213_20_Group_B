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
    '.cache/**',
    '.next/**',
    '.source/**',
    '.turbo/**',
    'node_modules/**',
    'next-env.d.ts',
  ]),
];

export default config;
