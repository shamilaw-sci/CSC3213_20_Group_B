---
title: People application internals
description: Runtime map of published people data, directory construction, profile interpretation, search, and project participation.
---

# People application internals

`apps/people` is a read-only public directory. It loads published JSON from the
configured People and Projects data origins, validates records, and converts
domain codes into explicit human-facing labels. Editing remains in Portal.

```mermaid
flowchart LR
  Visitor[Visitor] --> People[People app]
  People --> Manifest[People manifest and indexes]
  People --> Profiles[Validated profile records]
  People --> ProjectIndex[Projects by-person index]
  Manifest --> Directories[Staff and student directories]
  Profiles --> Detail[Profile tabs]
  ProjectIndex --> Detail
```

Directory pages and profile details use client loaders behind route-specific
skeletons. Dynamic profile and batch routes first verify their published route
identity on the server; confirmed absence calls Next.js `notFound()`, while
transport and validation failures remain errors. Nested profile and programme
batch `not-found.tsx` files retain the specific recovery message for the route.
These remote-data guards are explicitly dynamic rather than advertising empty
static parameter sets. Empty published collections, a missing route, and a
failed data request are separate states. See
[Published data and directories](PUBLISHED_DATA_AND_DIRECTORIES.md) and
[Profile interpretation](PROFILE_INTERPRETATION.md).
