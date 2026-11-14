---
title: Relational database portability
description: Incremental D1 and PostgreSQL migration boundaries.
---

# Relational database portability

The Cloudflare API runs on D1. Better Auth owns its user, session, account,
verification, passkey, and rate-limit tables. Application repositories retain
D1 as their Worker default. The Bun API entry point composes PostgreSQL for
Better Auth and every application-owned relational repository. Its startup
readiness check requires the tables produced by all eight reviewed PostgreSQL
migrations.

`createPostgresRelationalBindings(pool)` wires Better Auth and every
application-owned relational repository to one PostgreSQL pool. The Worker
imports none of these Node-only modules. The Bun entry point injects the pool
as `AUTH_DATABASE`; the Worker continues to require its `AUTH_DB` binding.

`createAuth` uses the existing `AUTH_DB` binding by default. The Bun
composition root injects a `pg.Pool` as `AUTH_DATABASE`, created by
`createPostgresAuthDatabase({ connectionString, schema, maxConnections })`.
The factory validates a PostgreSQL URL, a simple schema identifier, and a pool
size from 1 to 50. The Worker never imports this Node-only factory. Better Auth
uses its supported D1 and `pg.Pool` adapters; application repositories do not
receive a generic SQL interface from this connection.

The avatar rate-window repository has a narrow `read`, `consume`, and `reset`
contract. Its Worker default uses D1; a Bun/Node composition root can inject
`createPostgresAvatarRateRepository(pool)` as `AVATAR_RATE_REPOSITORY`.
PostgreSQL migration `0003_public_avatar_rate.sql` mirrors D1 migration 0006.
`consume` is one UPSERT with a conflict-row lock and `RETURNING` on PostgreSQL;
the D1 version remains one atomic UPSERT. A live test runs 16 competing updates
across two PostgreSQL pools, and the same contract runs against the D1 test
database. Both retain the quota-window and reset semantics.

The read-only auth identity lookup also accepts an injected PostgreSQL
repository. Its SQL reads Better Auth's already-migrated `user` and `account`
tables and retains the case-insensitive email, linked-provider, and numeric
GitHub ID behavior. The Worker continues to use its D1 implementation.

Proxy settings accept an injected `PROXY_SETTINGS_REPOSITORY`; D1 remains the
Worker default. PostgreSQL migration `0004_proxy_settings.sql` mirrors D1
migrations 0003 and 0005. User edits consume an attempt in one conditional
UPSERT; admin edits preserve the remaining allowance. The expiry reset is
guarded by the previously read window timestamp, and list pages use a
repeatable-read snapshot for their rows and total. Shared D1/PostgreSQL tests
cover concurrent attempts, admin edits, reset, username ambiguity, and paging.

Permissions and profile metadata accept an injected `PERMISSION_REPOSITORY`.
PostgreSQL migration `0005_permissions.sql` preserves role and access-level
constraints, JSON metadata, case-insensitive email uniqueness, and millisecond
creation timestamps. The PostgreSQL adapter serializes super-admin mutations
with a transaction-scoped advisory lock, so concurrent demotions or deletions
cannot remove the last super-admin. D1 retains its existing service-level
precheck; it does not provide this cross-request guarantee. Cross-backend
tests cover metadata and keyset paging; live PostgreSQL tests race a demotion
against a deletion across two pools.

Avatar review state and audit history accept an injected
`AVATAR_REVIEW_REPOSITORY`. PostgreSQL migration
`0006_public_avatar_moderation.sql` preserves status and action constraints,
JSON moderation reports, and millisecond timestamps. Review claims use one
conditional `UPDATE`; reopening checks both approved status and the caller's
review timestamp. Cancellation uses one `UPDATE ... RETURNING` without a page
limit, so only rows actually transitioned are audited. Cross-backend tests
cover missing rows, moderation, cursor ordering, cancellation and history; a
live two-pool test races twelve review claims and verifies one succeeds.

Identity decisions use the existing permission role as the effective value.
D1 migration `0008_identity_review.sql` and PostgreSQL migration
`0007_identity_review.sql` add review and audit records, then normalize
student-pattern accounts to the immutable `STUDENT` role with an audit entry.
The same migrations add accepted Honours submission history keyed by durable
operation ID.
The PostgreSQL decision path locks the permission row and commits the role,
review, and audit updates together. The D1 path batches those writes with a
conditional role update. Apply these migrations before enabling the new
identity endpoints; PostgreSQL integration tests require `POSTGRES_TEST_URL`.

D1 `0009_orcid_link.sql` and PostgreSQL `0008_orcid_link.sql` add a short-lived
OAuth intent linked to the Better Auth user and a unique index allowing one
ORCID account association per user. The existing provider-account uniqueness
index prevents one ORCID identifier from being attached to two users. The
callback stores the identifier, not the OAuth token. See
[ORCID association](SERVICES/API/IDENTITY_AND_STATE.md#orcid-association).

Drizzle ORM supports both [D1](https://orm.drizzle.team/docs/sqlite/connect-cloudflare-d1)
and [PostgreSQL](https://orm.drizzle.team/docs/connect-overview). It was evaluated
for the rate-window table. Three statements, including a dialect-specific
atomic UPSERT, do not benefit enough from two Drizzle schema definitions and a
new dependency, so this repository uses the official D1 binding and `pg` pool
directly. Re-evaluate Drizzle for a larger repository with repeated typed
queries; do not force it into every table.

## PostgreSQL migration path

The reviewed SQL in `services/api/migrations/postgres` is separate from the D1
SQLite migrations. `0001_better_auth.sql` is based on Better Auth 1.7.7's
generated PostgreSQL plan. `0002_auth_identity_uniqueness.sql` preserves the
extra account and passkey uniqueness rules from D1 migration 0002.
`0003_public_avatar_rate.sql` through `0008_orcid_link.sql` add
application-owned tables and indexes. Apply all eight
once, in order, within one transaction to an empty, dedicated schema. The
database role needs schema creation or ownership and table/index creation
privileges. Configure that schema as the connection's `search_path`, then
confirm Better Auth reports no outstanding migration steps. Do not use D1 SQL
files against PostgreSQL or run automatic schema pushes in production.

Before any real cutover, independently review all eight SQL migrations and the
data export/import procedure. Freeze writes, back up D1, export Better Auth
and application-owned tables, and import them into a fresh PostgreSQL schema.
Preserve IDs, epoch-millisecond timestamps, permission/proxy JSON, review
status and audit rows, and avatar rate-window rows; normalize permission emails
to lowercase and reject collisions before import. Import auth parent rows
before dependent sessions, accounts, and passkeys. Verify per-table counts,
foreign keys, uniqueness, JSON values, representative sessions, pending review
queues, current quotas, ORCID associations and pending intents, and proxy
attempt allowances. Store object-storage keys
unchanged and separately migrate objects if the storage provider changes.
Switch only after the complete API profile passes integration tests. A database
URL change does not copy data. Rollback after new writes requires reconciliation
rather than only restoring configuration.

The Bun API starts with `bun --filter '@scs/api' start:bun`. It validates
configuration, checks the migrated tables and object-store access, then serves
the same route dispatcher and Better Auth configuration as the Worker.
`/healthz` reports process health; `/readyz` becomes ready only after startup.
See [Self-hosted runtimes](SELF_HOSTED_RUNTIMES.md) for configuration and
shutdown behavior. This phase does not perform a live D1 data cutover.

## Local PostgreSQL integration test

`services/api/test/integration/postgres-auth.test.ts` creates a random schema,
applies migrations `0001` through `0008` in one transaction, checks the ORCID
intent table, tests Better Auth's PostgreSQL session read and identity
uniqueness, then drops the schema. The test runs only when
`POSTGRES_TEST_URL` points to an isolated disposable database. The ordinary Bun
test run skips this live test when the variable is absent. Never point it at a
production database: the test role must have schema creation and drop rights.
`services/api/test/avatar-rate-repo.test.ts` runs the D1 contract on every test
run and adds the live PostgreSQL concurrency check when the URL is present.

The current local run used a disposable PostgreSQL 17 container with test-only
credentials, a loopback-only port, and temporary storage. Testcontainers was
evaluated, but its Node implementation has an unresolved Bun/Windows named-pipe
compatibility issue; this test accepts a URL so it also works with a locally
installed PostgreSQL server or a CI-provisioned container. The container is a
test dependency, not an application deployment component.

PostgreSQL uses transactions and row-level locks; D1 supports atomic statements
and batches but not interactive transactions. Both avatar review adapters use
atomic conditional SQL updates rather than a read followed by a write.
Better Auth's generated `rateLimit.lastRequest` column is `BIGINT`
and stores Unix epoch **milliseconds**. Node-postgres returns `BIGINT` values
as strings by default; Better Auth 1.7.7's retry calculation adds the window
to that value, so a string can produce an incorrect retry interval. The
PostgreSQL pool configures a per-pool parser that converts safe `BIGINT` values
to numbers and rejects values outside JavaScript's safe integer range. A live
test checks the runtime type, stored millisecond value, and 429 retry interval.
The 1.7.7 schema checker still logs an `int8` type advisory despite the
migration planner reporting no missing steps; the column remains `BIGINT` to
avoid timestamp overflow.

References: [Better Auth PostgreSQL adapter](https://better-auth.com/docs/adapters/postgresql),
[Better Auth D1 transaction handling](https://better-auth.com/blog/1-5),
[Testcontainers PostgreSQL module](https://node.testcontainers.org/modules/postgresql/).
[Node-postgres type parsers](https://node-postgres.com/features/types).
