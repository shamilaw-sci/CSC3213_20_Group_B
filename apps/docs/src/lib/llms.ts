import { createGetUrl, llms } from 'fumadocs-core/source';

import { source } from '@/lib/source';

const docsContentRoute = '/llms.mdx/docs';

const getContentUrl = createGetUrl(docsContentRoute);

export const docsLlms = llms(source, {
  renderPage: async (page) => {
    const markdown = await page.data.getText('processed');

    return `# ${page.data.title} (${page.url})

${markdown}`;
  },
});

export function getPageMarkdownUrl(page: { slugs: string[] }) {
  const segments = [...page.slugs, 'content.md'];

  return {
    segments,
    url: getContentUrl(segments),
  };
}
