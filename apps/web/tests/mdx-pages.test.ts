import { readFile } from 'node:fs/promises';
import path from 'node:path';

const appRoot = path.resolve(import.meta.dirname, '..', 'src', 'app');

const pages = [
  ['(about)/about-us/page.mdx', 'About the department'],
  ['(about)/resources/page.mdx', 'Facilities and resources'],
  [
    '(courses)/undergraduate-courses/page.mdx',
    'Undergraduate study programmes',
  ],
  ['(courses)/postgraduate-courses/page.mdx', 'Postgraduate study programmes'],
  ['research/page.mdx', 'Research at the department'],
  ['services/page.mdx', 'Consultations and services'],
  ['societies/page.mdx', 'Student societies'],
  ['prizes-scholarships/page.mdx', 'Prizes and scholarships'],
  ['contact/page.mdx', 'Contact the department'],
] as const;

describe('department MDX pages', () => {
  test.each(pages)(
    '%s owns metadata and its page introduction',
    async (file, title) => {
      const source = await readFile(path.resolve(appRoot, file), 'utf8');

      expect(source).toContain('export const metadata');
      expect(source).toContain(`title="${title}"`);
      expect(source).not.toContain('DevelopmentPage');
    }
  );

  test('does not put Markdown text directly inside native paragraph or heading tags', async () => {
    const files = ['page.mdx', ...pages.map(([file]) => file)];

    for (const file of files) {
      const source = await readFile(path.resolve(appRoot, file), 'utf8');

      expect(source, file).not.toMatch(/<(?:p|h[1-6])[^>]*>\s*[A-Za-z]/);
    }
  });
});
