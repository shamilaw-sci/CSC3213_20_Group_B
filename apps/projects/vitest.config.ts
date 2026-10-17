import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, 'src') },
      { find: '@tests', replacement: path.resolve(__dirname, 'tests') },
    ],
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: 'src/setupTests.ts',
    globals: true,
  },
});
