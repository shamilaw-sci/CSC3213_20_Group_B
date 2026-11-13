import nextConfig from '@scs/eslint-config/next';
import {
  projectDirectory,
  tailwindProjectRoot,
  typescriptProjectRoot,
} from '@scs/eslint-config/project';
import { globalIgnores } from 'eslint/config';

const projectRoot = projectDirectory(import.meta.url);
const config = [
  ...nextConfig,
  typescriptProjectRoot(projectRoot),
  tailwindProjectRoot(projectRoot, 'src/styles/registry.css'),
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
