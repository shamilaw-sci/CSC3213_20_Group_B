---
title: Docs content pipeline
description: How root Markdown, metadata files, source loading, canonical routes, and relative links become handbook pages.
---

# Docs content pipeline

The Fumadocs MDX macro reads `../../docs` at build time and retains processed
Markdown for copy and agent-readable endpoints. `src/lib/source.ts` passes that
generated source to one loader with the `/docs` base URL.

## Source-to-route rules

`src/lib/documentation-path.ts` supplies the canonical route mapping:

| Source path                                 | Published route                                |
| ------------------------------------------- | ---------------------------------------------- |
| `ARCHITECTURE.md`                           | `/docs/architecture`                           |
| `SCHEMA_REFERENCE/ACADEMICS.md`             | `/docs/schema-reference/academics`             |
| `SERVICES/API/INDEX.md`                     | `/docs/services/api`                           |
| `APPLICATIONS/PORTAL/ROUTING_AND_ACCESS.md` | `/docs/applications/portal/routing-and-access` |

The mapper normalizes separators, removes `.md` or `.mdx`, converts underscores
to hyphens, lowercases each segment, and removes a final `INDEX`. This lets
source files follow the repository's `UPPER_SNAKE_CASE.md` rule while public
URLs remain conventional.

The custom MDX anchor resolves relative Markdown paths from the current source
file before applying the same mapping. Root-relative URLs, fragments, and URLs
with a protocol pass through unchanged. Authors therefore write links that work
in the checkout and on GitHub; the published page receives the correct nested
route automatically.

## Navigation ownership

Every content directory has a `meta.json` that declares its title and page
order. A parent file references the child directory once; the child owns its
internal ordering. This prevents the root navigation file from becoming a flat
inventory of every nested page.

The catch-all documentation route reads a page from the shared source loader.
Unknown slugs invoke the Next.js not-found boundary. `generateStaticParams`
returns the loader's complete page set, so handbook routes are generated from
the same inventory used by navigation and tests.

## Adding content safely

Add the Markdown and its nearest `meta.json` entry together. Keep exactly one
top-level heading after frontmatter, use relative `.md` links for repository
pages, and add a route assertion for a new required documentation family. Run
the authoring checks described in
[Documentation authoring](../../DOCUMENTATION_AUTHORING.md); do not hand-edit a
generated search or LLM artifact.
