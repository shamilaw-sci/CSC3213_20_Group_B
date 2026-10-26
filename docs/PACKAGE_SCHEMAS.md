---
title: Schemas package
description: Domain areas, exports, validation ownership, consumers, build output, and change workflow for packages/schemas.
---

# Schemas package

`packages/schemas` (`@scs/schemas`) is the direct source of shared runtime and
transport contracts. It exports Zod schemas and inferred types from one package
entry point; consumers import from the package and must not re-export those
contracts through app-local wrappers.

## Domain areas

The package covers API editor/error/mutation/operation/pagination/proxy/mail
contracts, academic organizations and periods, courses and offerings, people
identifiers and staff/student records, research records, and projects including
types, status, people roles, links, media, dates, and course context.

Schemas validate data at trust boundaries: public JSON reads, HTTP requests and
responses, database/provider results, and persisted records. UI-only state,
framework configuration, and service-private implementation models do not
belong here.

## Change workflow

1. Determine whether the change is additive or a deliberate canonical data
   migration. Legacy compatibility is not automatic.
2. Update the owning schema and its package tests.
3. Import the new contract directly in every producer and consumer.
4. Update fixture/public data and transport docs in the same change.
5. Run package build, lint, both typechecks, and tests, then verify affected
   applications and services.

The build uses TypeScript plus `tsc-alias`; source package exports support
workspace development. See [Schemas](SCHEMAS.md) for deeper modeling rules.
