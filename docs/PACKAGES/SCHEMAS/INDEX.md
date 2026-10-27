---
title: Schemas package internals
description: Maintainer guide to shared schema ownership, package exports, contract evolution, parsing behavior, and verification.
---

# Schemas package internals

`packages/schemas` is the repository's shared runtime-contract package. Each
Zod schema defines executable boundary validation and exports its inferred
TypeScript type from the same source.

```mermaid
flowchart LR
  Source[Domain schema] --> Index[Package entry point]
  Index --> Producer[API or service producer]
  Index --> Consumer[Application or service consumer]
  Source --> Tests[Runtime and contract tests]
  Source --> Docs[Schema reference]
```

The [schema reference](../../SCHEMA_REFERENCE/INDEX.md) describes the fields and
relationships. These pages describe how to own and change the package itself:
[Ownership and exports](OWNERSHIP_AND_EXPORTS.md) and
[Evolution and verification](EVOLUTION_AND_VERIFICATION.md).
