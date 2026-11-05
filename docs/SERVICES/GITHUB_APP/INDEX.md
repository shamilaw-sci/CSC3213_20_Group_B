---
title: GitHub App internals
description: Source map, trust boundary, domain ownership, and verification guide for Git-backed automation.
---

# GitHub App internals

`services/github-app` turns authorized internal commands into reviewable Git
changes. It is the only service in this monorepo that holds GitHub App
credentials. Browser code must never call it directly.

## Source map

| Area                   | Source             | Responsibility                                                                                           |
| ---------------------- | ------------------ | -------------------------------------------------------------------------------------------------------- |
| Worker entry           | `src/index.ts`     | validates runtime configuration, serves HTTP, consumes queue batches, and exports Durable Objects        |
| Local entry            | `src/server.ts`    | runs the same Hono application under Bun with process-local operation state                              |
| HTTP composition       | `src/app.ts`       | mounts authenticated operation and repository route families                                             |
| Controllers            | `src/controllers`  | validate transport input and translate domain results to HTTP                                            |
| Durable runtime        | `src/operations`   | operation identity, persistence, queue dispatch, retries, cancellation, and resource leases              |
| Domain operations      | `src/domains`      | profile, project, and academic commands, projections, and draft repositories                             |
| Direct PR repositories | `src/repositories` | synchronous profile, project, course, and student-placement PR workflows, including index reconciliation |
| GitHub adapters        | `src/github`       | App authentication, provider calls, snapshots, atomic commits, PR lookup, and error classification       |
| Contracts              | `@scs/schemas`     | operation envelopes, status/outcome types, and public-data records                                       |

## Trust boundary

The authentication middleware compares `X-Internal-Secret` with
`X_INTERNAL_SECRET` using SHA-256 digests and a timing-safe comparison. That
proves the request came through the trusted service boundary; controllers then
validate any actor headers and payloads they depend on. The secret is not a
browser token and must never be exposed by Portal or API responses.

Operation status and cancellation additionally require
`X-Actor-Subject-Id`. A non-admin actor may access only an operation whose
stored actor subject matches. `X-Actor-Admin: true` is trusted only because the
request has already passed internal-service authentication.

## Domain ownership

- Durable profile operations commit the authoritative person file and record
  aggregate targets in PR metadata. The direct PR repository also reconciles
  aggregate lists and the public People search index.
- Durable project operations commit or delete the authoritative project file.
  The direct PR repository also reconciles the project aggregate, manifest,
  and affected per-person indexes.
- Courses and offerings update their authoritative academic record through an
  atomic Git commit.
- Student placement updates the registry metadata that determines programme,
  stream, department, batch, alumni, and postgraduate interpretation.

Detailed guides:

- [Durable operations](DURABLE_OPERATIONS.md) covers identity, state,
  serialization, retries, cancellation, and queue behavior.
- [Repository mutations](REPOSITORY_MUTATIONS.md) covers snapshots, revisions,
  atomic commits, pull requests, and projections.
- [Runtime and recovery](RUNTIME_AND_RECOVERY.md) covers Cloudflare and local
  modes, bindings, observability, failure categories, and recovery boundaries.

## Verification map

Tests cover operation idempotency, concurrency, recovery, authorization,
GitHub error classification, atomic commits, gateways, each domain operation
and projection, repository behavior, and aggregate reconciliation.

```bash
bun --filter '@scs/github-app' lint
bun --filter '@scs/github-app' typecheck
bun --filter '@scs/github-app' typecheck:test
bun --filter '@scs/github-app' test
bun --filter '@scs/github-app' knip
bun --filter '@scs/github-app' build
```
