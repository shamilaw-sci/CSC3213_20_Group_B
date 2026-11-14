---
title: Schema ownership and exports
description: What belongs in the shared schema package, how domains are arranged, and how producers and consumers import its public API.
---

# Schema ownership and exports

A contract belongs in `@scs/schemas` when two deployables exchange it, when
published data must be validated consistently, or when a domain invariant must
be shared by independent producers and consumers.

## Domain layout

| Source area         | Contract families                                                     |
| ------------------- | --------------------------------------------------------------------- |
| `schemas/api`       | errors, editor permissions, mutations, operations, pages, proxy, mail |
| `schemas/academics` | organizations, programmes, periods, and academic years                |
| `schemas/courses`   | course codes, courses, offerings, and teaching roles                  |
| `schemas/people`    | identifiers, base person, social links, students, and staff unions    |
| `schemas/research`  | research records and conferences                                      |
| `schemas/projects`  | project identity, type, status, people, source, media, and dates      |

Service-private database rows, provider SDK objects, React state, and
presentation labels stay with their owner unless they cross a real runtime
boundary. A local convenience type is not enough reason to add a shared schema.

## Public API

`src/index.ts` is the only package entry point. It re-exports domain files by
their internal `#schemas/*` aliases. Consumers import runtime schemas and types
directly from `@scs/schemas`; internal source paths are not package exports.

The package export points at TypeScript source for workspace development.
`sideEffects: false` allows consumers to tree-shake unused contracts. The build
emits declarations and JavaScript into `dist`, then `tsc-alias` resolves
internal aliases in emitted files. Do not assume a successful consumer build
proves that distributable output or declarations are correct; run the package
build when export behavior changes.

The public-API contract test enumerates every expected runtime export and fails
on both missing and unexpected values. Adding a schema to the entry point is an
intentional public API change and requires updating that list. Type-only
exports are checked through compilation because they do not exist at runtime.
