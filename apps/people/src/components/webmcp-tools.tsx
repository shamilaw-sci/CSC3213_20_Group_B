'use client';

import { WebMcpToolError } from '@scs/webmcp';
import { useWebMcpTool } from '@scs/webmcp/react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

import { getPeopleSearchIndex } from '@/lib/data/people-data';

const searchSchema = z
  .object({
    query: z.string().trim().min(2).max(100),
    page: z.number().int().min(1).max(100).default(1),
  })
  .strict();
const openSchema = z
  .object({ identity: z.string().trim().min(1).max(150) })
  .strict();
const searchInputSchema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: 'Name, role, or public profile keyword',
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
    identity: {
      type: 'string',
      description: 'Identity from people.search_profiles',
    },
  },
  required: ['identity'],
  additionalProperties: false,
} as const;

export function WebMcpTools() {
  const router = useRouter();

  useWebMcpTool({
    name: 'people.search_profiles',
    description:
      'Searches published people profiles. Use to find a staff member or student by name or public keyword.',
    schema: searchSchema,
    inputSchema: searchInputSchema,
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async ({ query, page }) => {
      const pageSize = 3;
      const normalized = query.toLowerCase();
      const entries = await getPeopleSearchIndex();
      const matches = entries.filter((entry) =>
        entry.keywords.some((keyword) =>
          keyword.toLowerCase().includes(normalized)
        )
      );
      return {
        total_count: matches.length,
        page_size: pageSize,
        page,
        results: matches
          .slice((page - 1) * pageSize, page * pageSize)
          .map(({ identity, name, subtitle }) => ({
            identity,
            name: name.slice(0, 100),
            subtitle: subtitle.slice(0, 100),
          })),
      };
    },
  });

  useWebMcpTool({
    name: 'people.open_profile',
    description:
      'Opens a published person profile. Use after finding its identity with people.search_profiles.',
    schema: openSchema,
    inputSchema: openInputSchema,
    execute: async ({ identity }) => {
      const entry = (await getPeopleSearchIndex()).find(
        (person) => person.identity === identity
      );
      if (!entry || !entry.href.startsWith('/people/')) {
        throw new WebMcpToolError(
          'Published profile not found. Search profiles again.'
        );
      }
      router.push(entry.href);
      return { opened: entry.href };
    },
  });

  return null;
}
