---
title: People application
description: Public directory routes, data interpretation, profile rendering, configuration, and verification for apps/people.
---

# People application

`apps/people` (`@scs/people`) is the public staff and student directory. It
reads published people and related project records, validates them with
`@scs/schemas`, and renders browse and detail pages without privileged server
credentials.

For code-derived behavior, read the
[People internals](APPLICATIONS/PEOPLE/INDEX.md) guide:

- [Published data and directories](APPLICATIONS/PEOPLE/PUBLISHED_DATA_AND_DIRECTORIES.md)
  explains manifests, validation, caching, search, student placement, and
  prefetch bounds;
- [Profile interpretation](APPLICATIONS/PEOPLE/PROFILE_INTERPRETATION.md)
  defines academic labels, directory context, project roles, and project-only
  profiles.

## Routes and composition

The root introduces directory choices. Staff routes cover academic,
academic-support, and non-academic groups. Student routes cover computer
science, data science, and statistics streams with batch pages. Canonical
profiles use `/people/{identity}`. Route-specific skeletons and error surfaces
provide meaningful pending and failure states.

## Data semantics

Cards should prioritize portrait, name, and stable identifier; collection
context already explains the stream or batch. Profile tabs separate overview,
academic data, and projects without repeating the same label as unexplained
badges. Program, stream/department, honours track, level, and status are
different fields and must be labelled explicitly. Project participation renders
each schema role and must not replace multiple roles with a guessed title.

The app owns public interpretation and presentation. Profile and placement
changes belong to Portal/API/GitHub App. People displays approved pictures from
the API Worker and links owners to the separate Portal picture page. Configure
canonical, data, and API origins through typed public environment values.

## Change and verify

Trace the schema and published loader before changing labels. Keep server
rendering and static generation where the route supports them; minimize client
components to interactive controls. Run `test`, `typecheck`, `lint`, `knip`, and
`build`, then review representative staff, student batch, and profile routes in
both themes and narrow layouts.
