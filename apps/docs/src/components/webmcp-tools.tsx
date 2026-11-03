'use client';

import { WebMcpToolError } from '@scs/webmcp';
import { useWebMcpTool } from '@scs/webmcp/react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

export type Guide = { title: string; url: string; description?: string };

const searchSchema = z
  .object({
    query: z.string().trim().min(2).max(100),
    page: z.number().int().min(1).max(100).default(1),
  })
  .strict();
const openSchema = z
  .object({ url: z.string().trim().min(1).max(250) })
  .strict();
const searchInputSchema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: 'Guide title or description keywords',
    },
    page: {
      type: 'integer',
      description: 'Results page, starting at 1',
      minimum: 1,
      maximum: 100,
    },
  },
  required: ['query'],
  additionalProperties: false,
} as const;
const openInputSchema = {
  type: 'object',
  properties: {
    url: { type: 'string', description: 'Guide URL from docs.search_guides' },
  },
  required: ['url'],
  additionalProperties: false,
} as const;

export function WebMcpTools({ guides }: { guides: Guide[] }) {
  const router = useRouter();

  useWebMcpTool({
    name: 'docs.search_guides',
    description:
      'Searches documentation guide titles and descriptions. Use to find a handbook page on a repository topic.',
    schema: searchSchema,
    inputSchema: searchInputSchema,
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: ({ query, page }) => {
      const pageSize = 3;
      const words = query.toLowerCase().split(/\s+/u);
      const matches = guides.filter((guide) =>
        words.every((word) =>
          `${guide.title} ${guide.description ?? ''}`
            .toLowerCase()
            .includes(word)
        )
      );
      return {
        total_count: matches.length,
        page_size: pageSize,
        page,
        results: matches
          .slice((page - 1) * pageSize, page * pageSize)
          .map((guide) => ({
            title: guide.title.slice(0, 100),
            url: guide.url,
            description: guide.description?.slice(0, 100),
          })),
      };
    },
  });

  useWebMcpTool({
    name: 'docs.open_guide',
    description:
      'Opens a documentation guide. Use after finding its URL with docs.search_guides.',
    schema: openSchema,
    inputSchema: openInputSchema,
    execute: ({ url }) => {
      if (!guides.some((guide) => guide.url === url)) {
        throw new WebMcpToolError(
          'Guide not found. Search the guide index again.'
        );
      }
      router.push(url);
      return { opened: url };
    },
  });

  return null;
}
