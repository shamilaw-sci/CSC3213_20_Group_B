---
title: Department Web application
description: Ownership, content routes, redirects, configuration, tests, and change workflow for apps/web.
---

# Department Web application

`apps/web` is the public departmental website (`@scs/web`). It presents
department-owned institutional content and intentionally does not duplicate the
People directory, Projects showcase, or Portal workflows.

The [Department Web internals](APPLICATIONS/WEB/INDEX.md) guide documents the
implementation in depth:

- [Content and navigation](APPLICATIONS/WEB/CONTENT_AND_NAVIGATION.md) covers
  MDX ownership, cross-product links, metadata, and discovery files;
- [Routing and redirects](APPLICATIONS/WEB/ROUTING_AND_PROXYING.md) covers
  redirects, `.php` normalization, `~username` resolution, and trust boundaries.

## Structure and routes

Content pages are MDX under `src/app`: home, about, resources, undergraduate
and postgraduate courses, research, prizes and scholarships, services,
societies, and contact. Route handlers provide JSON, Atom, and RSS feeds.
`/people/*`, `/projects`, and `/e-learning` are cross-origin redirects to the
owning products. `src/components` holds product composition, `src/config`
contains typed public/server environment parsing, and `src/lib` contains
content and integration helpers.

## Boundaries

The app owns departmental narrative content and navigation. It may link to
People and Projects but must not reimplement their data browsers. Redirects to
another origin use normal document navigation so Next.js does not attempt an
RSC fetch across origins.

Configuration includes the canonical site URL and destinations for People,
Projects, and e-learning. See [Environment variables](ENVIRONMENT_VARIABLES.md).
Metadata, sitemap, robots, feeds, loading skeletons, and error pages are part of
the app contract.

## Change and verify

Keep content in MDX when it is editorial, app-specific composition in the app,
and shared primitives in `@scs/ui`. Run the declared `test`, `typecheck`,
`typecheck:test`, `lint`, `knip`, and `build` scripts. Review the result against
[UI quality assurance](UI_QUALITY_ASSURANCE.md).
