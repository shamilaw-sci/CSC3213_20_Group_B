---
title: Documentation authoring
description: How humans and agents add, link, validate, and publish repository documentation from root Markdown.
---

# Documentation authoring

Root `docs/**/*.md` files are the only authored handbook source. They remain
readable in an editor and on GitHub; `apps/docs` compiles the same files into the
published Fumadocs site.

## Add or change a page

1. Use an `UPPER_SNAKE_CASE.md` filename under `docs`.
2. Add bounded YAML frontmatter with non-empty `title` and `description`.
3. Keep exactly one visible `# H1` matching the page subject.
4. Add the page exactly once to `docs/meta.json`.
5. Add a direct Markdown link from the root `README.md` documentation table.
6. Use relative `.md` links between source pages. The site rewrites them to
   lowercase kebab-case `/docs/*` routes.
7. Run `bun run docs:check`, `bun run test:docs`, and the `@scs/docs` tests and
   build.

Mermaid fences are supported and remain readable in source. Prefer tables for
exact mappings, Mermaid for flows or ownership, and prose for details. Do not
publish credentials, private incident data, provider identifiers that are not
already public configuration, or copied third-party documentation.

The published site also derives static search, `/llms.txt`, `/llms-full.txt`,
and per-page Markdown from the same source. Page actions let readers copy or
open that Markdown and edit the owning file on GitHub. Do not maintain a second
search index or agent-only copy of the handbook.

Update documentation in the same commit as changed commands, routes,
environment variables, workflows, deployment steps, or boundaries. Remove
completed plans once their durable decisions are represented in living pages.
