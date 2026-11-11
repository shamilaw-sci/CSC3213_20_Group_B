---
title: Self-hosted Bun runtimes
description: API and GitHub App Bun composition, requirements, and verification.
---

# Self-hosted Bun runtimes

The API and GitHub App have Bun entry points that reuse their Cloudflare route
handlers and business services. The optional
[departmental Compose profile](DEPARTMENTAL_DEPLOYMENT.md) packages these
runtimes. For a direct Bun deployment, install the pinned Bun version and
workspace dependencies on the target platform. Sharp needs its matching native
binary and libvips. Keep both
services behind HTTPS and restrict GitHub App access to the API; use distinct,
strong internal secrets. The API derives the client IP from its direct socket
and replaces any incoming `cf-connecting-ip` header. If deployed behind a
reverse proxy, set `TRUSTED_PROXY_IP` to its exact socket address. The API
then requires a valid `X-SCS-Client-IP` supplied by that proxy and rejects
other peers. The proxy must overwrite that header with its observed client
address. Health endpoints remain available for private container checks.

## Required infrastructure

- PostgreSQL 17 with a dedicated API schema containing all six reviewed API
  migrations, a distinct operation schema containing both reviewed GitHub App
  migrations, and a distinct schema for pg-boss. Apply migrations with a
  deployment role before startup; the GitHub App never migrates pg-boss at
  startup. See
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

Before either service starts, set `POSTGRES_MIGRATION_URL` to a dedicated
deployment credential, set `API_POSTGRES_SCHEMA`,
`OPERATIONS_POSTGRES_SCHEMA`, and `PGBOSS_SCHEMA` to three distinct schema
names. Set `API_RUNTIME_ROLE` and `OPERATIONS_RUNTIME_ROLE` to the respective
runtime database roles, then run `bun services/github-app/scripts/migrate-postgres.ts` from the
repository root. The script serializes runners with a PostgreSQL session
advisory lock, applies the reviewed API and operation SQL in transactions,
records SHA-256 checksums, and invokes pg-boss's official migration CLI.
It refuses untracked existing tables or changed migration files. Back up the
database and independently review new SQL and pg-boss plans before an update.
Do not grant the runtime roles schema migration privileges.

## Configuration

The API requires `POSTGRES_URL`, `POSTGRES_SCHEMA`, `BETTER_AUTH_SECRET`,
`BETTER_AUTH_URL`, `PORTAL_ORIGIN`, `AUTH_COOKIE_DOMAIN`, both OAuth client IDs and secrets, `MAILER_API_URL`,
`MAILER_API_KEY`, `GITHUB_APP_API_URL`, `GITHUB_APP_INTERNAL_SECRET`,
`DATA_PUBLIC_BASE_URL`, `WEB_PROXY_INTERNAL_SECRET`, `TYPESAFE_API_KEY`, and
`AVATAR_S3_BUCKET`, `AVATAR_S3_REGION`, `AVATAR_S3_ENDPOINT`,
`AVATAR_S3_ACCESS_KEY_ID`, `AVATAR_S3_SECRET_ACCESS_KEY`. `API_PORT` defaults
to 3001. `PORTAL_ORIGIN` is the HTTPS Portal origin and sets the allowed
origin and passkey RP ID. `AUTH_COOKIE_DOMAIN` is the shared parent domain
with a leading dot, such as `.example.edu`; Portal and API must use its
`portal` and `api` subdomains. The Bun API uses Sharp and the S3 adapter. It has no production
in-memory or D1 fallback.

The GitHub App requires `POSTGRES_URL`, `POSTGRES_SCHEMA`, `PGBOSS_SCHEMA`,
`GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_INSTALLATION_ID`, `GITHUB_OWNER`,
`GITHUB_PEOPLE_DATA_REPOSITORY`, `GITHUB_PROJECTS_DATA_REPOSITORY`, and
`X_INTERNAL_SECRET`. `PORT` defaults to 3000. The two schemas must differ.
The API's `GITHUB_APP_INTERNAL_SECRET` must equal the GitHub App's
`X_INTERNAL_SECRET`. Keep the services on independently managed listeners.

The Mailer Bun entry point exposes `/healthz` and `/readyz` for private
container checks and stops its HTTP listener on `SIGINT` or `SIGTERM`.
Readiness confirms that the configured process is serving; it does not prove
that the external SMTP server can accept mail. Keep `/send` reachable only
from the API and require its bearer token.

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
