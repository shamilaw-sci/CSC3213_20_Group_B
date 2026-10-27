---
title: Docs application internals
description: Runtime map of the Fumadocs handbook, its source pipeline, navigation, search, metadata, and agent-readable outputs.
---

# Docs application internals

`apps/docs` publishes the repository handbook. The authored source remains the
Markdown under the root `docs` directory; the application does not maintain a
second content copy or a database-backed content model.

```mermaid
flowchart LR
  Markdown[docs Markdown and meta.json] --> Macro[Fumadocs MDX source]
  Macro --> Loader[Typed source loader]
  Loader --> Pages[Static handbook pages]
  Loader --> Search[Static search endpoint]
  Loader --> Sitemap[Sitemap and metadata]
  Loader --> LLM[llms.txt and page Markdown]
```

The application owns the presentation and publication pipeline. The repository
documentation rules remain in
[Documentation authoring](../../DOCUMENTATION_AUTHORING.md), and the content's
technical truth remains owned by the workspace being documented.

Read [Content pipeline](CONTENT_PIPELINE.md) before adding a content feature or
changing routes. Read [Discovery and rendering](DISCOVERY_AND_RENDERING.md)
before changing search, metadata, agent-readable feeds, Markdown components, or
Mermaid behavior.
