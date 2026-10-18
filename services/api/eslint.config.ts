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
];

export default config;
