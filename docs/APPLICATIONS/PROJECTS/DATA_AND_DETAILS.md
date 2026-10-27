---
title: Projects data and details
description: Published-data clients, validation, cache behavior, loading and failure states, project fields, short links, and related-project scoring.
---

# Projects data and details

All project records are validated with `ProjectSchema` imported directly from
`@scs/schemas`. The app has separate server-oriented and browser-oriented data
helpers because sitemaps and home metadata need published data during server
execution while interactive directories own retryable browser states.

## Data paths

| Consumer                   | Published input                | Missing behavior         |
| -------------------------- | ------------------------------ | ------------------------ |
| server queries and sitemap | `projects.json`                | validated empty list     |
| browser directory          | `projects.json`                | explicit not-found error |
| browser project detail     | `projects/{encoded-slug}.json` | explicit not-found error |

Both helpers keep an in-memory promise cache for five minutes and remove a
failed promise before rethrowing, allowing later retries. The server helper
uses `cache: no-store` and supports the configured `local` data mode as an
empty registry. The browser helper distinguishes `404` with
`ProjectDataNotFoundError` from other request failures.

Directories show a page-shaped skeleton while loading, a retry action for
transport or validation failures, a collection-not-found state for absent
categories and topics, and an empty state for valid collections without
projects. Detail routes load the target project and full project list together;
they distinguish a missing record from a failed request and avoid state updates
after their effect is cleaned up.

## Detail interpretation

Project presentation follows the shared schema: title, short and long
descriptions, status, type, categories, topics, dates, academic context, course,
people, media, and links are rendered only when present. Course links point to
the department's course information. People links point to the configured
People origin. Each participant keeps the role attached to that project; the
showcase does not infer a universal role for the person.

`/projects/{project_slug}` is canonical. `/p/{project_slug}` permanently
redirects to the encoded canonical path and carries no separate rendering
logic.

Related projects exclude the active project and receive three points for the
same type, two per shared category, and one per shared topic. Results with a
zero score are removed; remaining projects sort by score, then newest update,
then slug, and the first three are shown. Keep this deterministic if the
ranking changes, and add tests for ties and exclusion rules.
