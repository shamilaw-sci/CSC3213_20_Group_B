import nextConfig from '@scs/eslint-config/next';
import {
  tailwindProjectRoot,
  typescriptProjectRoot,
} from '@scs/eslint-config/project';
import { globalIgnores } from 'eslint/config';

const config = [
  ...nextConfig,
  typescriptProjectRoot(import.meta.dirname),
  tailwindProjectRoot(import.meta.dirname, 'src/styles/registry.css'),
  {
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
      // Shared primitives consume theme utilities supplied by each owning app.
      'better-tailwindcss/no-unknown-classes': 'off',
    },
  },
  globalIgnores(['node_modules/**']),
];

export default config;
