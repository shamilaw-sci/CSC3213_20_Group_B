'use client';

import { useWebMcpTool } from '@scs/webmcp/react';
import { z } from 'zod';

import { fetchProject, fetchProjects } from '@/lib/projects/api-client';
import { filterProjectsByCollection } from '@/lib/projects/collections';

const searchSchema = z
  .object({
    query: z.string().trim().min(2).max(100),
    page: z.number().int().min(1).max(100).default(1),
  })
  .strict();
const inspectSchema = z
  .object({ slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,119}$/u) })
  .strict();
const searchInputSchema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: 'Project title, topic, person, or keyword',
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
const inspectInputSchema = {
  type: 'object',
  properties: {
    slug: { type: 'string', description: 'Project slug from projects.search' },
  },
  required: ['slug'],
  additionalProperties: false,
} as const;

export function WebMcpTools() {
  useWebMcpTool({
    name: 'projects.search',
    description:
      'Searches published projects. Use to find work by title, topic, person, or keyword.',
    schema: searchSchema,
    inputSchema: searchInputSchema,
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async ({ query, page }, { signal }) => {
      const projects = await fetchProjects(signal);
      const matches = filterProjectsByCollection(projects, {
        kind: 'search',
        query,
      });
      const pageSize = 3;
      const result = matches.slice((page - 1) * pageSize, page * pageSize);
      return {
        total_count: matches.length,
        page_size: pageSize,
        page,
        results: result.map(({ slug, title, shortDescription }) => ({
          slug,
          title: title.slice(0, 100),
          shortDescription: shortDescription.slice(0, 100),
        })),
      };
    },
  });

  useWebMcpTool({
    name: 'projects.inspect',
    description:
      'Inspects a published project. Use after identifying a project slug from projects.search.',
    schema: inspectSchema,
    inputSchema: inspectInputSchema,
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async ({ slug }, { signal }) => {
      const project = await fetchProject(slug, signal);
      return {
        slug: project.slug,
        title: project.title.slice(0, 150),
        summary: project.shortDescription.slice(0, 500),
        status: project.status,
        url: `/projects/${project.slug}`,
      };
    },
  });

  return null;
}
