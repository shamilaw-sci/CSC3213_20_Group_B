'use client';

import { WebMcpToolError } from '@scs/webmcp';
import { useWebMcpTool } from '@scs/webmcp/react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

import {
  primaryNavigation,
  secondaryNavigation,
} from '@/config/navigation.config';

const sections = [...primaryNavigation, ...secondaryNavigation]
  .filter((item) => item.destination === 'local')
  .map(({ href, label }) => ({ href, label }));
const listSchema = z.object({}).strict();
const openSchema = z.object({ href: z.string() }).strict();
const emptyInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const;
const openInputSchema = {
  type: 'object',
  properties: {
    href: { type: 'string', description: 'Path from web.list_sections' },
  },
  required: ['href'],
  additionalProperties: false,
} as const;

export function WebMcpTools() {
  const router = useRouter();

  useWebMcpTool({
    name: 'web.list_sections',
    description:
      'Lists department website sections. Use to find the right page for study, research, resources, or contact information.',
    schema: listSchema,
    inputSchema: emptyInputSchema,
    annotations: { readOnlyHint: true },
    execute: () => ({ sections }),
  });

  useWebMcpTool({
    name: 'web.open_section',
    description:
      'Opens a department website section. Use after choosing a path from web.list_sections.',
    schema: openSchema,
    inputSchema: openInputSchema,
    execute: ({ href }) => {
      const section = sections.find((item) => item.href === href);
      if (!section)
        throw new WebMcpToolError(
          'Unknown section. Call web.list_sections for valid paths.'
        );
      router.push(section.href);
      return { opened: section.href };
    },
  });

  return null;
}
