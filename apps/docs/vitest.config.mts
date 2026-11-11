import { createRequire } from 'node:module';
import path from 'node:path';

import mdx from 'fumadocs-mdx/vite';
import { defineConfig } from 'vitest/config';

const resolveFromDocs = createRequire(import.meta.url);

export default defineConfig({
  plugins: mdx(undefined, {
    macro: {
      include: ['src/lib/source.ts'],
    },
  }),
  resolve: {
    alias: [
      {
        find: 'react/jsx-dev-runtime',
        replacement: resolveFromDocs.resolve('react/jsx-dev-runtime'),
      },
      { find: '@', replacement: path.resolve(import.meta.dirname, 'src') },
      {
        find: 'collections',
        replacement: path.resolve(import.meta.dirname, '.source'),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: 'src/setupTests.ts',
    globals: true,
  },
});
