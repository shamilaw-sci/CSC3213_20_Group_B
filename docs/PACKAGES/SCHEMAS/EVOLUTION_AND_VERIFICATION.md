---
title: Schema evolution and verification
description: Boundary parsing, defaults, unions, refinements, mutation compatibility, migrations, tests, and consumer verification.
---

# Schema evolution and verification

Zod parsing can reject, normalize, default, or transform input. A schema edit is
therefore a runtime behavior change, not just a TypeScript declaration change.

## Modeling rules

- use enums for closed domain vocabularies and discriminated unions when one
  field determines the valid shape;
- use `.strict()` where unknown transport fields must be rejected, and make
  that choice explicit rather than assuming every object behaves identically;
- put cross-field invariants in refinements, such as project completion dates
  following start dates or course projects requiring an offering;
- use defaults only when the canonical parsed value truly owns that default;
- infer exported types from schemas instead of duplicating interfaces.

Transport contracts carry operational guarantees as well as shape. Mutation
control requires a bounded idempotency key and optional expected revision.
Accepted mutations expose only queued or running status, a canonical operation
status URL, and a bounded retry delay. Terminal operation variants pair their
status with a matching outcome.

## Change classification

Before changing a contract, identify all producers, consumers, fixtures,
published records, and documentation:

1. An additive optional field may still require UI, persistence, and public
   data decisions.
2. A new enum value is breaking for exhaustive switches even if old records
   still parse.
3. A required field, renamed value, tighter refinement, or removed variant
   requires a deliberate canonical data migration.
4. Legacy aliases or dual shapes are not added automatically. Migrate the
   authoritative data and update every consumer when the task chooses a new
   canonical shape.

Test the smallest schema rule directly, then the domain composition, public API
exports, and affected producer/consumer behavior. Run package lint, production
and test typechecks, tests, and build. For transport changes, also update
[API contracts](../../API_CONTRACTS.md); for public records, update the
[schema reference](../../SCHEMA_REFERENCE/INDEX.md) and public-data docs.
