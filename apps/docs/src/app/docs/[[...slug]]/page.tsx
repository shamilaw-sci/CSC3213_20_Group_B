import {
  DocsBody,
  DocsDescription,
  DocsPage,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from 'fumadocs-ui/layouts/docs/page';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getMDXComponents } from '@/components/mdx/mdx-components';
import { siteConfig } from '@/config/site.config';
import { getPageMarkdownUrl } from '@/lib/llms';
import {
  createDocumentationMetadata,
  getDocumentationSourceUrl,
} from '@/lib/metadata';
import { source } from '@/lib/source';

type DocumentationPageProps = {
  params: Promise<{ slug?: string[] }>;
};

export default async function DocumentationPage({
  params,
}: DocumentationPageProps) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const markdownUrl = getPageMarkdownUrl(page).url;

  return (
    <DocsPage toc={page.data.toc}>
      <DocsDescription>{page.data.description}</DocsDescription>
      <div
        className="border-fd-border flex items-center gap-2 border-b pt-2 pb-6"
      >
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <ViewOptionsPopover
          markdownUrl={markdownUrl}
          pageUrl={new URL(page.url, siteConfig.origin).toString()}
          githubUrl={getDocumentationSourceUrl(page.data.info.path)}
        />
      </div>
      <DocsBody>
        <MDX components={getMDXComponents(page.data.info.path)} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({
  params,
}: DocumentationPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  return createDocumentationMetadata({
    title: page.data.title,
    description: page.data.description,
    url: page.url,
  });
}
