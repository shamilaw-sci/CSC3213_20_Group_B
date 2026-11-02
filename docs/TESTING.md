---
title: Testing and verification
description: Test layers, workspace gates, repository-wide checks, CI parity, and evidence required before completion.
---

# Testing and verification

For guarded HTTP load tests, browser diagnostics, synthetic fixtures and
capacity reports, see [Performance testing](PERFORMANCE_TESTING.md).
`bun run perf:check` verifies the framework without load traffic;
`bun run perf:verify-local` performs only a tiny loopback fixture check.

Tests live in the owning workspace's `test` or `tests` directory. Production
TypeScript and test TypeScript are checked separately where a workspace defines
`typecheck:test`.

## During a change

Run the smallest relevant test first. Then run only scripts declared by the
workspace:

```powershell
bun --filter '<workspace>' lint
bun --filter '<workspace>' typecheck
bun --filter '<workspace>' typecheck:test
bun --filter '<workspace>' test
bun --filter '<workspace>' build
```

Do not describe an absent script as a passing check. Browser behavior that
cannot be proven by unit tests should have a focused runtime check; provider
integrations that require credentials should record that validation boundary.

## Repository gate

Shared and repository-wide changes run the full sequence documented in
[Development](DEVELOPMENT.md): documentation policy, repository tests, Knip,
formatting, lint, both TypeScript scopes, tests, builds, and `git diff --check`.
CI uses affected-workspace checks for pull requests and the complete monorepo on
the merge queue and `main`.

Repository policy treats Docs as the fifth Next.js application. Tests enforce
its route-specific loading states, fallback hierarchy, static search,
environment declaration, and cached build output alongside the four product
applications.

Tests should assert public behavior and contract boundaries. Mock external
providers at their clients, not internal implementation details. For mutation
flows, cover validation, authorization, revision conflicts, idempotent retries,
and operation status transitions.
