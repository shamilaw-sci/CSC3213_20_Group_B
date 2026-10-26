import { loader } from 'fumadocs-core/source';
import { defineDocs } from 'fumadocs-mdx/macro';

import { toDocumentationSlugs } from '@/lib/documentation-path';

const docs = defineDocs({
  dir: '../../docs',
  docs: {
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  slugs(file) {
    return toDocumentationSlugs(file.path);
  },
});
