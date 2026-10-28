---
title: Route reference
description: Public application paths, Portal workflow areas, API route families, automation endpoints, and redirects.
---

# Route reference

This page is an index, not a replacement for route source or
[API contracts](API_CONTRACTS.md). Dynamic values are shown in braces.

## Public applications

| App      | Important paths                                                                                                                                                                                                 |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web      | `/`, `/about-us`, `/resources`, `/undergraduate-courses`, `/postgraduate-courses`, `/research`, `/services`, `/societies`, `/contact`, feed routes, and external redirects for People, Projects, and e-learning |
| People   | `/staff/*`, `/students/{stream}/{batch}`, `/people/{identity}`                                                                                                                                                  |
| Projects | `/browse/{segments}`, `/categories/{category}/{segments}`, `/topics/{topic}/{segments}`, `/types/{type}/{segments}`, `/search/{query}/{segments}`, `/projects/{slug}`, and short redirect `/p/{slug}`           |
| Portal   | `/login`, `/signup`, `/dashboard`, `/account/*`, `/user/*`, `/academic/courses/*`, and `/admin/*`                                                                                                               |
| Docs     | `/`, `/docs/{page}`, `/api/search`, `/llms.txt`, `/llms-full.txt`, per-page Markdown, `/sitemap.xml`, and `/robots.txt`                                                                                         |

The Portal serves the authoritative document at
`https://portal.scs-pdn.space/.well-known/security.txt`. Every public app and
service permanently redirects case-insensitive GET and HEAD requests for
`/security.txt` or `/.well-known/security.txt` to that URL. Other methods keep
their existing routing behavior.

## Service route families

The API exposes Better Auth routes plus `/api/me`, `/api/me/proxy`,
`/api/people/v2/*`, `/api/projects/v2/*`, `/api/academic/v2/*`,
`/api/admin/*`, and `/api/operations/{id}`. The GitHub App exposes internal
operation, profile, project, course, and course-offering routes. The mailer
exposes authenticated `POST /send`.

Routes that leave an application origin must use a document navigation rather
than Next.js client navigation. Preserve canonical path-based discovery; do not
introduce query-string navigation where a stable browse path exists.
