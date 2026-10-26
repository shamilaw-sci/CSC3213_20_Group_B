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
});
