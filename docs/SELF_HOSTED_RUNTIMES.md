---
title: Self-hosted Bun runtimes
description: Phase 6 API and GitHub App composition, requirements, and verification.
---

# Self-hosted Bun runtimes

The API and GitHub App have Bun entry points that reuse their Cloudflare route
handlers and business services. This is runtime composition, not deployment
packaging. Install the pinned Bun version and workspace dependencies on the
target platform. Sharp needs its matching native binary and libvips. Keep both
services behind HTTPS and restrict GitHub App access to the API; use distinct,
strong internal secrets. The API derives the client IP from its direct socket
and replaces any incoming `cf-connecting-ip` header. If deployed behind a
reverse proxy, configure and test an explicit trusted-proxy policy before
depending on client-IP rate limits.

## Required infrastructure

- PostgreSQL 17 with a dedicated API schema containing all six reviewed API
  migrations, a distinct operation schema containing both reviewed GitHub App
  migrations, and a distinct schema for pg-boss. The GitHub App role needs
  pg-boss schema migration privileges at startup. See
  [database portability](DATABASE_PORTABILITY.md) and
  [durable operations](SERVICES/GITHUB_APP/DURABLE_OPERATIONS.md).
- A private S3-compatible bucket with get, put, head, delete, and atomic
  conditional `PutObject` support. The S3 driver probes both conditional
  operations before writing a pointer. Do not switch providers without copying
  existing objects; see [storage](STORAGE.md).
- Reachable Mailer, public profile data, GitHub, OAuth providers, and TypeSafe
  moderation endpoints for their respective workflows. Use production secrets
  only in deployment secret management.

Start the GitHub App with `bun --filter '@scs/github-app' start`, then the API
with `bun --filter '@scs/api' start:bun`. The GitHub App starts pg-boss, queues,
the worker, and outbox recovery before accepting requests. Both expose
`/healthz` and `/readyz`. `SIGINT` and `SIGTERM` stop HTTP acceptance and close
the owned resources. The API waits for tracked Better Auth background tasks
and closes its PostgreSQL pool. The GitHub App stops the worker and pg-boss,
then closes its pool. A Windows Bun child process may terminate before its
JavaScript signal handler; Linux signal tests are required to verify shutdown.

## Configuration

The API requires `POSTGRES_URL`, `POSTGRES_SCHEMA`, `BETTER_AUTH_SECRET`,
`BETTER_AUTH_URL`, both OAuth client IDs and secrets, `MAILER_API_URL`,
`MAILER_API_KEY`, `GITHUB_APP_API_URL`, `GITHUB_APP_INTERNAL_SECRET`,
`DATA_PUBLIC_BASE_URL`, `WEB_PROXY_INTERNAL_SECRET`, `TYPESAFE_API_KEY`, and
`AVATAR_S3_BUCKET`, `AVATAR_S3_REGION`, `AVATAR_S3_ENDPOINT`,
`AVATAR_S3_ACCESS_KEY_ID`, `AVATAR_S3_SECRET_ACCESS_KEY`. `API_PORT` defaults
to 3001. The Bun API uses Sharp and the S3 adapter. It has no production
in-memory or D1 fallback.

The GitHub App requires `POSTGRES_URL`, `POSTGRES_SCHEMA`, `PGBOSS_SCHEMA`,
`GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_INSTALLATION_ID`, `GITHUB_OWNER`,
`GITHUB_PEOPLE_DATA_REPOSITORY`, `GITHUB_PROJECTS_DATA_REPOSITORY`, and
`X_INTERNAL_SECRET`. `PORT` defaults to 3000. The two schemas must differ.
The API's `GITHUB_APP_INTERNAL_SECRET` must equal the GitHub App's
`X_INTERNAL_SECRET`. Keep the services on independently managed listeners.

## Live verification

Use an isolated PostgreSQL 17 database and a disposable private S3 bucket with
test-only credentials. Set `POSTGRES_TEST_URL` and `S3_TEST_BUCKET`,
`S3_TEST_ENDPOINT`, `S3_TEST_REGION`, `S3_TEST_ACCESS_KEY_ID`, and
`S3_TEST_SECRET_ACCESS_KEY`, and explicitly set `S3_TEST_ALLOW_WRITES=1`, then run the API and storage integration test
files without a cache. The tests create random PostgreSQL schemas and object
keys and remove them afterward. Never point these variables at production.
The API test mocks only TypeSafe classification, so it exercises actual
PostgreSQL, S3, Sharp, Better Auth, and both Bun HTTP services. Live OAuth,
passkey registration, Mailer delivery, and GitHub mutations still require
separate provider credentials and staging verification.
