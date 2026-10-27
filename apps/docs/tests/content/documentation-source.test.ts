import { describe, expect, test } from 'vitest';

import { source } from '@/lib/source';

const requiredPages = [
  '/docs/application-web',
  '/docs/application-people',
  '/docs/application-projects',
  '/docs/application-portal',
  '/docs/service-api',
  '/docs/service-github-app',
  '/docs/service-mailer',
  '/docs/package-schemas',
  '/docs/package-ui',
  '/docs/documentation-authoring',
  '/docs/schema-reference',
  '/docs/schema-reference/academics',
  '/docs/schema-reference/people',
  '/docs/schema-reference/courses',
  '/docs/schema-reference/research',
  '/docs/schema-reference/projects',
  '/docs/schema-reference/api-transport',
] as const;

describe('documentation corpus', () => {
  test('publishes the required workspace and authoring guides', () => {
    const urls = new Set(source.getPages().map((page) => page.url));

    for (const url of requiredPages) expect(urls).toContain(url);
  });

  test('has unique routes and complete page metadata', () => {
    const pages = source.getPages();
    const urls = pages.map((page) => page.url);

    expect(new Set(urls).size).toBe(urls.length);
    for (const page of pages) {
      expect(page.data.title.trim()).not.toBe('');
      expect(page.data.description?.trim()).not.toBe('');
    }
  });
});
