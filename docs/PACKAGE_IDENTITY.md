---
title: Identity package
description: Pure institutional account classification and Honours selection rules in packages/identity.
---

# Identity package

`@scs/identity` contains deterministic rules used by the API's identity and
Honours workflows. It depends on `@scs/schemas` for roles, review status,
departments, subjects, programmes, and student records. It does not access a
database, call Jev, authorize HTTP requests, or submit GitHub operations.

| Export                                            | Purpose                                                                                                                                      |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `parseStudentIdentifier`, `defaultRoleForEmail`   | Recognize `sYYNNN` and `sYYspNNN` institutional addresses and assign the immutable `STUDENT` default.                                        |
| `validateRoleAssignment`, `resolveRole`           | Enforce the student role lock and resolve a role from student pattern, approved mapping, existing role, or default.                          |
| `normalizeReviewStatus`, `interpretJevSuggestion` | Normalize review values and interpret optional AI suggestions without changing a role.                                                       |
| `canManageStudentHonours`                         | Check that the chosen programme belongs to the actor's department and that an existing programme or published subject supports that scope.   |
| `parseHonoursSelection`                           | Expand three-digit indices and inclusive ranges within one batch, apply exclusions then additions, and reject empty or oversized selections. |

The selection parser defaults to a 500-identifier limit; callers may request a
limit from 1 to 1,000. It returns sorted identifiers and excluded identifiers.
The API still verifies accounts, public profiles, actor permissions, revisions,
and idempotency before accepting a mutation. See
[Authentication](AUTHENTICATION.md), [API contracts](API_CONTRACTS.md), and
[Portal Honours workflow](APPLICATION_PORTAL.md#interaction-model).

Run the declared package gate after changing a rule:

```bash
bun --filter '@scs/identity' lint
bun --filter '@scs/identity' typecheck
bun --filter '@scs/identity' typecheck:test
bun --filter '@scs/identity' test
bun --filter '@scs/identity' build
```
