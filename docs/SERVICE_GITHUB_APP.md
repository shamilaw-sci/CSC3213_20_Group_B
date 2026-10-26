---
title: GitHub App service
description: Internal automation routes, durable operations, repository mutations, queues, credentials, and verification.
---

# GitHub App service

`services/github-app` (`@scs/github-app`) is the internal Cloudflare Worker that
turns validated API requests into durable, reviewable changes in the public-data
repository.

## Responsibilities

The service reads and writes public profiles, student placement metadata,
projects, courses, and course offerings. Controllers validate transport input;
domain repositories calculate canonical file changes; GitHub gateways handle
provider APIs. Operation and mutation-coordinator Durable Objects persist
status and serialize work by resource. A Cloudflare Queue runs asynchronous
operations with retry and dead-letter behavior.

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
