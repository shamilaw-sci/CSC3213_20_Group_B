import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';

import { Mermaid } from '@/components/mdx/mermaid';
import { rewriteDocumentationHref } from '@/lib/documentation-path';

const DefaultAnchor = defaultMdxComponents.a;

export function getMDXComponents(
  sourcePath?: string,
  components?: MDXComponents
) {
  return {
    ...defaultMdxComponents,
    Mermaid,
    a: ({ href = '', ...props }) => (
      <DefaultAnchor
        {...props}
        href={rewriteDocumentationHref(href, sourcePath)}
      />
    ),
    ...components,
  } satisfies MDXComponents;
}

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
