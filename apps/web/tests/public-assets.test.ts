// @vitest-environment node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const publicRoot = resolve(import.meta.dirname, '../public');
const requiredAssets = [
  'favicon.ico',
  'favicon/android-chrome-72x72.png',
  'favicon/android-chrome-72x72.webp',
  'favicon/android-chrome-144x144.png',
  'favicon/android-chrome-144x144.webp',
  'favicon/android-chrome-192x192.png',
  'favicon/android-chrome-192x192.webp',
  'favicon/android-chrome-512x512.png',
  'favicon/android-chrome-512x512.webp',
  'favicon/apple-touch-icon-180x180.png',
  'favicon/favicon.ico',
  'favicon/favicon-16x16.png',
  'favicon/favicon-16x16.webp',
  'favicon/favicon-32x32.png',
  'favicon/favicon-32x32.webp',
  'favicon/favicon-42x42.png',
  'favicon/favicon-42x42.webp',
  'favicon/favicon-48x48.png',
  'favicon/favicon-48x48.webp',
  'favicon/logo-symbol-icon.svg',
  'favicon/site.webmanifest',
] as const;

describe('Web public metadata assets', () => {
  test.each(requiredAssets)('ships %s', (asset) => {
    expect(existsSync(resolve(publicRoot, asset))).toBe(true);
  });

  test('owns a department-specific manifest', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(publicRoot, 'favicon/site.webmanifest'), 'utf8')
    ) as { name?: string; short_name?: string };

    expect(manifest).toMatchObject({
      name: 'Department of Statistics & Computer Science',
      short_name: 'SCS PDN',
    });
  });
});
