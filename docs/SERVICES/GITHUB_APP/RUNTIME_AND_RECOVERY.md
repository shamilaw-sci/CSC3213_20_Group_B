---
title: GitHub App runtime and recovery
description: Cloudflare and local runtime modes, bindings, failure evidence, dead-letter handling, and safe recovery.
---

# GitHub App runtime and recovery

The service supports two execution adapters around the same Hono controllers
and domain code. Production correctness depends on the Cloudflare bindings;
local Bun mode deliberately trades durability for easy development.

## Runtime modes

| Capability                 | Cloudflare Worker                             | Local Bun server                       |
| -------------------------- | --------------------------------------------- | -------------------------------------- |
| HTTP application           | `src/index.ts` calls `app.fetch`              | `src/server.ts` calls `app.fetch`      |
| configuration              | Worker bindings parsed per invocation context | T3 Env parses `process.env` at startup |
| operation state            | `OPERATION_STATE` Durable Objects             | process-local in-memory map            |
| resource serialization     | `MUTATION_COORDINATOR` Durable Objects        | process-local promise tails            |
| dispatch                   | `OPERATION_QUEUE` and queue consumer          | `queueMicrotask` in the same process   |
| persistence across restart | yes                                           | no                                     |

`parseRuntimeConfig` trims required identifiers, converts escaped private-key
newlines, validates the port, and stores the request's configuration in
`AsyncLocalStorage`. Domain factories read that request-local configuration;
they must not cache credentials or repository coordinates globally.

## Cloudflare resources

Wrangler declares two SQLite Durable Object classes, one producer and consumer
queue with a dead-letter queue, Node.js compatibility, and Worker logs. The
binding names and the full environment inventory are documented in
[Environment variables](../../ENVIRONMENT_VARIABLES.md). Durable Object
migrations are separate from API D1 migrations.

The HTTP executor uses the durable implementation only when both operation
state and coordinator bindings are present; otherwise it selects the local
in-memory implementation used by Bun development. The queue consumer is
stricter and fails when either durable binding is unavailable. Operators must
therefore verify the complete binding set: a partially wired HTTP deployment
must not be mistaken for durable operation processing.

## Failure evidence

For a failed or stalled operation, collect these identifiers before changing
state:

1. API and GitHub App correlation ID;
2. operation ID, status, attempt, and last error category;
3. resource type and resource ID;
4. queue delivery or dead-letter evidence;
5. branch, PR, current entity revision, and current ref SHA; and
6. deployed commit and binding configuration.

Do not record secrets, private-key content, bearer headers, or mutation
payloads in incident notes.

## Recovery decisions

| Observed state                           | Safe action                                                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| queued with normal queue delivery        | wait and poll; do not resubmit with a new key                                                            |
| resource lease busy                      | allow the scheduled short retry; inspect only if the lease remains beyond its bounded lifetime           |
| retryable provider error                 | allow operation attempts and Queue retry policy to finish                                                |
| terminal conflict                        | refresh published or draft data and submit a reviewed change with the expected current revision          |
| terminal failure                         | inspect category and repository state before deciding whether the same logical request should be retried |
| dead-lettered message                    | reconcile operation state, branch, commit, and PR before replaying the original operation ID or key      |
| operation succeeded but client timed out | return the persisted status; do not create another PR                                                    |
| cancellation requested while running     | wait for the current provider call and next safe boundary                                                |

Never delete Durable Object state merely to make a retry possible. The state is
the evidence that prevents duplicate work. Never force-push a shared mutation
branch to repair a compare conflict.

## Deployment checks

Build success proves configuration shape, not provider access. After deploying,
verify internal authentication, one representative read, one non-production
operation from submission through terminal status, queue health, Durable Object
bindings, repository installation access, and logs that contain correlation
metadata without sensitive values. Record unavailable credential-dependent
checks as an explicit boundary rather than a pass.
