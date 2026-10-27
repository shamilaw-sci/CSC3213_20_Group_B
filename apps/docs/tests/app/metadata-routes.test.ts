import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

import robots from '@/app/robots';
import sitemap from '@/app/sitemap';

describe('documentation metadata routes', () => {
  test('publishes canonical page URLs without internal routes', () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(urls).toContain('https://docs.scs-pdn.space/');
    expect(urls).toContain('https://docs.scs-pdn.space/docs/api-contracts');
    expect(urls.some((url) => url.includes('/api/'))).toBe(false);
    expect(urls.some((url) => url.includes('llms'))).toBe(false);
  });

  test('allows public pages and advertises the canonical sitemap', () => {
    const value = robots();

    expect(value.rules).toEqual({ userAgent: '*', allow: '/' });
    expect(value.sitemap).toBe('https://docs.scs-pdn.space/sitemap.xml');
  });

  test('publishes the shared SCS identity and theme metadata', () => {
    const layout = readFileSync(
      resolve(import.meta.dirname, '../../src/app/layout.tsx'),
      'utf8'
    );
    const manifest = JSON.parse(
      readFileSync(
        resolve(import.meta.dirname, '../../public/favicon/site.webmanifest'),
        'utf8'
      )
    ) as { name: string; short_name: string };

    expect(layout).toContain("manifest: '/favicon/site.webmanifest'");
    expect(layout).toContain("url: '/favicon/favicon-32x32.png'");
    expect(layout).toContain('export const viewport: Viewport');
    expect(layout).toContain('Source_Serif_4');
    expect(manifest).toMatchObject({
      name: 'SCS PDN Documentation',
      short_name: 'SCS Docs',
    });
  });
});
