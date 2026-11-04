---
title: Docs discovery and rendering
description: Search, metadata, sitemap, agent-readable Markdown, MDX components, and Mermaid rendering behavior.
---

# Docs discovery and rendering

All discovery outputs derive from the same typed source loader as the visible
handbook. A page missing from that loader is missing from navigation, static
generation, search, the sitemap, and agent-readable exports.

## Discovery outputs

| Output                         | Derivation and purpose                               |
| ------------------------------ | ---------------------------------------------------- |
| `/api/search`                  | static Fumadocs search index over the source         |
| `/sitemap.xml`                 | home plus every source page, with absolute URLs      |
| `/robots.txt`                  | allows the site and points to the sitemap            |
| `/llms.txt`                    | compact handbook index for agents                    |
| `/llms-full.txt`               | combined processed content for the complete handbook |
| `/llms.mdx/docs/**/content.md` | processed Markdown for one canonical page            |

The page UI uses the per-page Markdown URL for copy and view actions and builds
the GitHub edit URL from the source path. Metadata is generated from the same
page title, description, canonical route, and site origin. Do not add a
manually maintained search catalog or agent-only documentation tree.

## MDX rendering

The default Fumadocs MDX components are retained. The application overrides
links to rewrite repository Markdown paths and adds a `Mermaid` component for
diagrams. The shell links directly to the main GitHub repository; there is no
repository selector, persisted repository preference, or alternate rendered
variant.

Fumadocs' `remarkMdxMermaid` turns Mermaid code fences into the registered
`Mermaid` component. The client component loads Pele on demand, mounts the SVG
after hydration, and destroys the mount on navigation or source changes. Pele
observes container width and redraws when needed. Fumadocs theme tokens feed
Pele CSS variables, so light/dark changes recolor diagrams without rerendering.
Invalid or unsupported diagrams show their original Mermaid source. Pele filters
links and styles in diagrams; the renderer does not accept arbitrary HTML.

## Failure and consistency checks

The catch-all page and per-page Markdown route reject unknown content. Tests
assert required routes, unique URLs, complete title and description metadata,
link rewriting, search content, and LLM endpoint behavior. The Docs build then
proves that the MDX corpus compiles and all static parameters can be generated.

The repository-wide `docs:check` remains a separate source-quality gate. Both
are required: a valid MDX build does not prove the handbook follows repository
naming, heading, and link policy, while `docs:check` does not prove the website
can render the corpus.
