---
title: Projects application
description: Showcase browsing, path filters, project details, public data, configuration, and verification for apps/projects.
---

# Projects application

`apps/projects` (`@scs/projects`) is the public project showcase. Its interface
is organized for direct discovery rather than administrative editing.

## Routes

`/browse/{segments}` is the general catalogue. Categories, topics, and project
types use path-based routes under `/categories`, `/topics`, and `/types`.
Search terms also use `/search/{query}/{segments}` so useful states remain
linkable without query-string-only navigation. Canonical details are
`/projects/{project_slug}`; `/p/{project_slug}` is the supported short redirect.

Course references lead to the department's course information rather than
duplicating course pages inside the showcase. Detail pages present title,
summary, status, type, categories, topics, dates, media, links, course context,
and people roles when present in the schema. Do not infer or overwrite a
participant role.

## Data and ownership

The app fetches published project JSON from its configured data origin and
validates with `ProjectSchema`. People links use the configured People origin;
department links use the department origin. Editing remains in Portal.

## Change and verify

When adding a browse dimension, define its canonical path parser and tests
before changing UI. Keep filters understandable to non-technical visitors and
make the active selection obvious without redundant controls. Run `test`, both
typechecks, `lint`, `knip`, and `build`; cover home, browse, each dimension,
search, detail, short redirect, loading, and not-found behavior.
