import workerConfig from '@scs/eslint-config/worker';
import { globalIgnores } from 'eslint/config';

export default [
  globalIgnores([
    'node_modules',
    'dist',
    '.wrangler',
    '.cache',
    'eslint.config.ts',
  ]),
  ...workerConfig,
];
