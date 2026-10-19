import { typescriptProjectRoot } from '@scs/eslint-config/project';
import workerConfig from '@scs/eslint-config/worker';
import { globalIgnores } from 'eslint/config';

const config = [
  globalIgnores([
    'node_modules',
    'dist',
    '.wrangler',
    '.cache',
    'eslint.config.ts',
  ]),
  ...workerConfig,
  typescriptProjectRoot(import.meta.dirname),
];

export default config;
