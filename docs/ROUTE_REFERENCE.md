---
title: Route reference
description: Public application paths, Portal workflow areas, API route families, automation endpoints, and redirects.
---

# Route reference

This page is an index, not a replacement for route source or
[API contracts](API_CONTRACTS.md). Dynamic values are shown in braces.

## Public applications

| App                      | Important paths                                                                                                                                                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web                      | `/`, `/about-us`, `/resources`, `/undergraduate-courses`, `/postgraduate-courses`, `/research`, `/services`, `/societies`, `/contact`, feed routes, `/~{username}/{path}` temporary redirects, and `/people/*`, `/projects`, `/moodle` external redirects |
| People                   | `/staff/*`, `/students/{stream}/{batch}`, `/people/{identity}`                                                                                                                                                                                            |
| Projects                 | `/browse/{segments}`, `/categories/{category}/{segments}`, `/topics/{topic}/{segments}`, `/types/{type}/{segments}`, `/search/{query}/{segments}`, `/projects/{slug}`, and short redirect `/p/{slug}`                                                     |
| Portal                   | `/login`, `/signup`, `/dashboard`, `/account/*`, `/user/*`, `/academic/courses/*`, and `/admin/*`                                                                                                                                                         |
| Docs                     | `/`, `/docs/{page}`, `/api/search`, `/llms.txt`, `/llms-full.txt`, per-page Markdown, `/sitemap.xml`, and `/robots.txt`                                                                                                                                   |
| Local performance viewer | `/`, `/reports/{runId}`; reads generated files from `packages/performance/results`                                                                                                                                                                        |

The Portal serves the authoritative document at
`https://portal.scs-pdn.space/.well-known/security.txt`. Every public app and
service permanently redirects case-insensitive GET and HEAD requests for
`/security.txt` or `/.well-known/security.txt` to that URL. Other methods keep
their existing routing behavior.

Dynamic HTML routes use the owning application's `not-found.tsx` boundary for
confirmed missing entities. Projects also reject absent category and topic
collections and out-of-range collection pages. Upstream transport or validation
failures remain errors and are not converted into `404` responses.

## Service route families

The API exposes Better Auth routes plus `/api/me`, `/api/me/proxy`,
`/api/orcid/connect`, `/api/orcid/callback`, `/api/orcid/me`, and
`/api/orcid/public/{username}`, the authenticated Web resolver
`/api/internal/proxies/{username}`,
`/api/people/v2/*`, `/api/projects/v2/*`, `/api/academic/v2/*`,
`/api/admin/*`, and `/api/operations/{id}`. Public People avatar routes are
listed in [API contracts](API_CONTRACTS.md#public-profile-management). The GitHub App exposes internal
operation, profile, project, course, and course-offering routes. The mailer
exposes authenticated `POST /send`.

Routes that leave an application origin must use a document navigation rather
than Next.js client navigation. Preserve canonical path-based discovery; do not
introduce query-string navigation where a stable browse path exists.
