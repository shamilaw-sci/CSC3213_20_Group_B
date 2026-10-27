---
title: Projects application internals
description: Runtime map of project discovery paths, canonical filters, published data, detail rendering, and related-project ranking.
---

# Projects application internals

`apps/projects` is a public showcase, not an editor. It turns published project
records into stable path-based browse, type, category, topic, search, and detail
routes. Portal owns changes to those records.

```mermaid
flowchart LR
  Visitor[Visitor] --> Paths[Canonical collection paths]
  Paths --> Directory[Client project directory]
  Directory --> All[projects.json]
  Visitor --> Detail[Project detail route]
  Detail --> One[projects/slug.json]
  Detail --> All
  All --> Related[Related-project ranking]
```

The server route validates path shape and builds metadata; interactive
directories and detail views fetch their published data in the browser. Read
[Collection routes and search](COLLECTION_ROUTES_AND_SEARCH.md) before changing
URLs or filters, and [Data and details](DATA_AND_DETAILS.md) before changing
fetching, validation, record presentation, or related projects.
