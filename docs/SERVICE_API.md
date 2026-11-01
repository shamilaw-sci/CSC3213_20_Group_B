---
title: API service
description: Browser-facing API ownership, Better Auth, D1 state, route families, downstream services, and verification.
---

# API service

`services/api` (`@scs/api`) is the Cloudflare Worker boundary for Portal. It
owns Better Auth, D1-backed auth/proxy/permission state, authorization, request
validation, pagination, and orchestration of mail and Git-backed mutations.

## Structure

`src/routes` dispatches HTTP routes. `src/services` implements use cases;
`src/repositories` owns D1/provider persistence; `src/clients` calls Mailer and
GitHub App; `src/auth` configures Better Auth; middleware handles CORS and
security boundaries. Request and response contracts come directly from
`@scs/schemas`.

Route families include `/api/me`, proxy and admin-user management, the
server-only `/api/internal/proxies/:username` Web resolver,
`/api/people/v2`, `/api/projects/v2`, `/api/academic/v2`, and durable operation
status. Better Auth routes are mounted by the Worker entry point. List routes
are bounded and page-based.

## Runtime state and integrations

`AUTH_DB` is the D1 binding. The Worker calls Mailer with an internal bearer
token and prefers the `GITHUB_APP` service binding for automation, with the
configured URL as the deployment boundary where applicable. Secrets remain
server-side. Database changes use checked-in D1 migrations and must be applied
through the documented operations process.

## Change and verify

Validate untrusted input on entry, authorize before provider work, map domain
errors to stable HTTP responses, and make externally retried mutations
idempotent. Run all declared lint, typecheck, test, Knip, and build scripts; add
route/service tests for success, validation, forbidden, conflict, and provider
failure paths.

## Detailed implementation guide

Read [API internals](SERVICES/API/INDEX.md) for the source map, then use:

- [Request lifecycle](SERVICES/API/REQUEST_LIFECYCLE.md) for edge dispatch,
  CORS, pagination, and downstream failure mapping;
- [Identity and state](SERVICES/API/IDENTITY_AND_STATE.md) for Better Auth,
  permissions, D1 migrations, and proxy state; and
- [Public-data mutations](SERVICES/API/PUBLIC_DATA_MUTATIONS.md) for profile,
  project, academic, idempotency, revision, and operation workflows.
