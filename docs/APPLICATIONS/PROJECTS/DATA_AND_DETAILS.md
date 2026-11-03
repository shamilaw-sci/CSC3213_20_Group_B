---
title: Projects data and details
description: Published-data clients, validation, cache behavior, loading and failure states, project fields, short links, and related-project scoring.
---

# Projects data and details

All project records are validated with `ProjectSchema` imported directly from
`@scs/schemas`. The app has separate aggregate and route-oriented data helpers.
Sitemaps and home metadata tolerate an unavailable empty registry, while public
detail and collection routes preserve missing-record semantics.

## Data paths

| Consumer                   | Published input                | Missing behavior                 |
| -------------------------- | ------------------------------ | -------------------------------- |
| server queries and sitemap | `projects.json`                | validated empty list             |
| collection route           | `projects.json`                | `notFound()` for invalid route   |
| project detail route       | `projects/{encoded-slug}.json` | `notFound()` for missing project |

Both helpers keep an in-memory promise cache for five minutes and remove a
failed promise before rethrowing, allowing later retries. The server helper
uses `cache: no-store` and supports the configured `local` data mode as an
empty registry. The browser helper distinguishes `404` with
`ProjectDataNotFoundError` from other request failures.

Collection routes load and validate their published result set before
rendering. Absent categories or topics and pages beyond the available result
set call `notFound()`; a valid first page may still show an empty result state.
The directory renders from that server-provided list, while its search form is
the interactive client island; there is no second browser data request. Detail
routes load the target project and full project list on the server, call
`notFound()` only for the typed missing-project error, and let transport or
validation failures reach the route error boundary. Each collection family and
the project detail segment owns a nested `not-found.tsx`, so the not-found
response keeps its category-, topic-, search-, type-, page-, or project-specific
explanation.

## Detail interpretation

Project presentation follows the shared schema: title, short and long
descriptions, status, type, categories, topics, dates, academic context, course,
people, media, and links are rendered only when present. Course links point to
the department's course information. People links point to the configured
People origin. Each participant keeps the role attached to that project; the
showcase does not infer a universal role for the person.

When a record has a GitHub repository source, its project detail page fetches
the repository root `.docs/index.json` through the GitHub contents API. The
published record stores the exact `source.indexUrl` for new submissions; older
records can derive it from repository owner and name. The index may override
any project field except `id` and `slug`. `ProjectIndexSchema` rejects those
identifiers and unsupported fields; the merged object must pass
`ProjectSchema`. An unavailable or invalid index leaves the published record
visible. The fetch is cached for five minutes. Portal permissions use the
published record, so new index people gain edit access only after a data sync
is merged.

Dynamic reads do not update listing or person projections. The data repository's
manual **Sync Project Repository Indexes** action materializes available indexes
into authoritative project files, preserves ID and slug, and regenerates
projections. Missing indexes are skipped; other fetch or validation errors stop
the action before it writes project files.

`/projects/{project_slug}` is canonical. `/p/{project_slug}` permanently
redirects to the encoded canonical path and carries no separate rendering
logic.

Related projects exclude the active project and receive three points for the
same type, two per shared category, and one per shared topic. Results with a
zero score are removed; remaining projects sort by score, then newest update,
then slug, and the first three are shown. Keep this deterministic if the
ranking changes, and add tests for ties and exclusion rules.
