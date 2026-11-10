---
title: Relational database portability
description: Incremental D1 and PostgreSQL migration boundaries.
---

# Relational database portability

The API currently runs on Cloudflare D1. Better Auth owns its user, session,
account, verification, passkey, and rate-limit tables. Application repositories
still use D1 directly for permissions, proxy settings, avatar quotas, review,
and audit. This increment adds a PostgreSQL connection for **Better Auth only**;
it is not yet a self-hosted API profile. Do not deploy it until application
repositories have PostgreSQL implementations and a Bun API entry point exists.

`createAuth` uses the existing `AUTH_DB` binding by default. A Bun/Node
composition root may inject a `pg.Pool` as `AUTH_DATABASE`, created by
`createPostgresAuthDatabase({ connectionString, schema, maxConnections })`.
The factory validates a PostgreSQL URL, a simple schema identifier, and a pool
size from 1 to 50. The Worker never imports this Node-only factory. Better Auth
uses its supported D1 and `pg.Pool` adapters; application repositories do not
receive a generic SQL interface from this connection.

## PostgreSQL migration path

The reviewed SQL in `services/api/migrations/postgres` is separate from the D1
SQLite migrations. `0001_better_auth.sql` is based on Better Auth 1.7.7's
generated PostgreSQL plan. `0002_auth_identity_uniqueness.sql` preserves the
extra account and passkey uniqueness rules from D1 migration 0002. Apply both
once, in order, within one transaction to an empty, dedicated schema. The
database role needs schema creation or ownership and table/index creation
privileges. Configure that schema as the connection's `search_path`, then
confirm Better Auth reports no outstanding migration steps. Do not use D1 SQL
files against PostgreSQL or run automatic schema pushes in production.

Before any real cutover, design and review PostgreSQL migrations for every
application-owned table and a data export/import procedure. Freeze writes,
back up D1, copy all auth and application rows while preserving IDs and
timestamps, verify counts, foreign keys, uniqueness, and representative
sessions, then switch only after the complete API profile passes integration
tests. A database URL change does not copy data. Rollback after new writes
requires reconciliation rather than only restoring configuration.

## Local PostgreSQL integration test

`services/api/test/integration/postgres-auth.test.ts` creates a random schema,
applies the reviewed SQL, tests Better Auth's PostgreSQL session read and
identity uniqueness, then drops the schema. It runs only when
`POSTGRES_TEST_URL` points to an isolated disposable database. The ordinary Bun
test run skips this live test when the variable is absent. Never point it at a
production database: the test role must have schema creation and drop rights.

The current local run used a disposable PostgreSQL 17 container with test-only
credentials, a loopback-only port, and temporary storage. Testcontainers was
evaluated, but its Node implementation has an unresolved Bun/Windows named-pipe
compatibility issue; this test accepts a URL so it also works with a locally
installed PostgreSQL server or a CI-provisioned container. The container is a
test dependency, not an application deployment component.

PostgreSQL uses transactions and row-level locks; D1 supports atomic statements
and batches but not interactive transactions. The proxy attempt UPSERT and
avatar quota/review transitions remain D1-only and must retain their atomic
predicates when migrated. Do not emulate them with an unguarded read followed
by a write. Better Auth's generated `rateLimit.lastRequest` column is `BIGINT`;
its 1.7.7 schema checker logs a type advisory for that column even when its
migration planner reports no missing steps.

References: [Better Auth PostgreSQL adapter](https://better-auth.com/docs/adapters/postgresql),
[Better Auth D1 transaction handling](https://better-auth.com/blog/1-5),
[Testcontainers PostgreSQL module](https://node.testcontainers.org/modules/postgresql/).
