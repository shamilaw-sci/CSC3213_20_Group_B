---
title: API internals
description: Source map, responsibilities, dependencies, and verification boundaries for the browser-facing API Worker.
---

# API internals

`services/api` is the only backend that the Portal browser calls directly. It
combines Better Auth, D1-backed application state, authorization, public-data
reads, and orchestration of the two internal services. It does not write the
public-data repositories or send SMTP messages itself.

## Source map

| Area             | Source                          | Responsibility                                                                                    |
| ---------------- | ------------------------------- | ------------------------------------------------------------------------------------------------- |
| Worker entry     | `src/index.ts`                  | binds the execution context, applies edge guards, then selects Better Auth or application routing |
| Authentication   | `src/auth/auth.ts`              | Better Auth providers, OTP, passkeys, sessions, account linking, rate limits, and auth hooks      |
| Edge policy      | `src/middleware` and `src/http` | CORS, session resolution, stable errors, and unexpected-error containment                         |
| Routing          | `src/routes/index.ts`           | method and exact/prefix path dispatch                                                             |
| Use cases        | `src/services`                  | authorization, validation, public-data interpretation, and downstream orchestration               |
| D1 access        | `src/repositories`              | permissions, auth-account and ORCID lookup, identity review, Honours history, and proxy settings  |
| Internal clients | `src/clients`                   | bounded calls to GitHub App; mail delivery is wrapped in `src/services/mailer.service.ts`         |
| Contracts        | `@scs/schemas`                  | shared request, response, operation, person, project, and academic schemas                        |
| D1 schema        | `migrations`                    | append-only Better Auth and application-state migrations                                          |

## Runtime boundaries

The Worker receives bindings through `Env` in `src/types/env.ts`. `AUTH_DB` is
its only database. Public records are read from `DATA_PUBLIC_BASE_URL`; changes
are submitted to GitHub App. A configured Cloudflare `GITHUB_APP` service
binding is preferred, while `GITHUB_APP_API_URL` remains the HTTP transport
boundary. OTP delivery goes to Mailer with `MAILER_API_KEY`.

Detailed guides:

- [Request lifecycle](REQUEST_LIFECYCLE.md) explains dispatch, CORS, response
  behavior, pagination, and downstream failure mapping.
- [Identity and state](IDENTITY_AND_STATE.md) explains Better Auth, ORCID,
  account classification, Honours history, permission resolution, and D1
  ownership.
- [Public-data mutations](PUBLIC_DATA_MUTATIONS.md) explains profile, project,
  course, and offering workflows, including durable operations.

Use [Service API](../../SERVICE_API.md) for the concise maintainer entry point,
[Authentication](../../AUTHENTICATION.md) for system-wide identity policy, and
[Schema reference](../../SCHEMA_REFERENCE/INDEX.md) for domain fields.

## Verification map

`test/characterization` pins HTTP behavior and compatibility at the Worker
boundary. `test/unit` covers auth configuration, session cookies, pagination,
the GitHub App client, Mailer request construction, and public-project helpers.
The workspace gate is:

```bash
bun --filter '@scs/api' lint
bun --filter '@scs/api' typecheck
bun --filter '@scs/api' typecheck:test
bun --filter '@scs/api' test
bun --filter '@scs/api' knip
bun --filter '@scs/api' build
```
