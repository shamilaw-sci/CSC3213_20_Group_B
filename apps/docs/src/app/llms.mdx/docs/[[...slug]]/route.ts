import { notFound } from 'next/navigation';

import { docsLlms } from '@/lib/llms';
import { source } from '@/lib/source';

type MarkdownRouteContext = {
  params: Promise<{ slug?: string[] }>;
};

export const revalidate = false;

export async function GET(_request: Request, { params }: MarkdownRouteContext) {
  const { slug } = await params;
  const slugs = slug?.slice(0, -1) ?? [];
  if (slugs.at(-1) === 'index') slugs.pop();

  const page = source.getPage(slugs);
  if (!page) notFound();

  return new Response(await docsLlms.page(page), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}

export function generateStaticParams() {
  return source.generateParams().map(({ slug }) => ({
    slug: [...slug, 'content.md'],
  }));
}
