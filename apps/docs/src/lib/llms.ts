import { createGetUrl, llms } from 'fumadocs-core/source';

import { source } from '@/lib/source';

export const docsContentRoute = '/llms.mdx/docs';

const getContentUrl = createGetUrl(docsContentRoute);

export const docsLlms = llms(source, {
  renderPage: async (page) => `# ${page.data.title} (${page.url})

${await page.data.getText('processed')}`,
});

export function getPageMarkdownUrl(page: { slugs: string[] }) {
  const segments = [...page.slugs, 'content.md'];

  return {
    segments,
    url: getContentUrl(segments),
  };
}
