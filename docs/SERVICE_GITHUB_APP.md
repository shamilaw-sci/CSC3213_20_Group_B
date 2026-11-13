---
title: GitHub App service
description: Internal automation routes, durable operations, repository mutations, queues, credentials, and verification.
---

# GitHub App service

`services/github-app` (`@scs/github-app`) is the internal service that turns
validated API requests into durable, reviewable changes in the public-data
repository. It has Cloudflare Worker and
[self-hosted Bun](SELF_HOSTED_RUNTIMES.md) entry points.

## Responsibilities

The service reads and writes public profiles, student placement metadata,
projects, courses, and course offerings. Controllers validate transport input;
domain repositories calculate canonical file changes; GitHub gateways handle
provider APIs. In Cloudflare, Durable Objects persist operation status and
serialize work by resource; a Queue runs asynchronous operations. The Bun
runtime uses PostgreSQL for state and coordination and pg-boss for delivery,
retries, and dead-letter handling.

The Honours bulk operation validates each selected student against the current
GitHub record, preserves unrelated profile fields, and publishes one commit and
pull request for the batch. It uses a `profile/` branch so the data repository's
trusted pull-request workflow generates batch, special-stream, and search
projections on that same pull request. Operation status records queue, retry,
conflict, failure, and PR creation outcomes; published People data changes only
after the pull request merges and deploys. Self-submitted student profile writes
recheck protected Honours fields against GitHub's current published record and
any open draft. A retried bulk operation restores PR labels or recognizes an
already merged PR before attempting another commit.

Internal routes expose health, operation status/cancellation, and resource
read/update/discard/submit actions. They require the shared internal secret;
browser clients must go through the API. Actor headers are trusted only after
that service authentication succeeds.

## Mutation invariants

- Check the caller's expected revision before updating a record.
- Use operation and idempotency identifiers so retries do not create duplicate
  pull requests or commits.
- Keep concurrent mutations for one resource ordered.
- Store operation state without treating unavailable provider results as
  success.
- Return shared transport shapes from `@scs/schemas`.

Run lint, both typechecks, tests, Knip, and build. Provider-credential tests are
an explicit deployment validation boundary; unit tests use bounded fakes around
GitHub and Cloudflare adapters.

## Detailed implementation guide

Read [GitHub App internals](SERVICES/GITHUB_APP/INDEX.md) for the source map,
then use:

- [Durable operations](SERVICES/GITHUB_APP/DURABLE_OPERATIONS.md) for operation
  identity, persistence, queues, leases, retries, and cancellation;
- [Repository mutations](SERVICES/GITHUB_APP/REPOSITORY_MUTATIONS.md) for
  snapshots, revisions, atomic commits, pull requests, and projections; and
- [Runtime and recovery](SERVICES/GITHUB_APP/RUNTIME_AND_RECOVERY.md) for
  production and local adapters, failure evidence, and safe recovery.
