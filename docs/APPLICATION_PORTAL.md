---
title: Portal application
description: Authenticated workflows, route areas, API boundary, form modes, permissions, and verification for apps/portal.
---

# Portal application

`apps/portal` (`@scs/portal`) is the authenticated management interface. It
calls `services/api`; it never receives GitHub App credentials or calls private
automation routes directly.

## Route areas

- `/login`, `/signup`, `/privacy`, and `/tos` cover entry and policy.
- `/dashboard` and `/account/*` cover the current account.
- `/user/me/*`, `/user/projects/*`, and `/user/proxy` cover member workflows.
- `/academic/courses/*` manages academic records.
- `/admin/users/*`, `/admin/projects/*`, `/admin/proxies`, and
  `/admin/academic-rules` cover permission-protected administration.

## Interaction model

Editors offer a clear human-friendly form as the default and an advanced JSON
representation when the schema supports it. Switching modes preserves the same
validated draft and makes the active view visually unambiguous. Published data,
working edits, pull-request state, revision conflicts, and asynchronous
operation progress are separate states; labels and actions must not blur them.

Top navigation reflects the current session. Signed-in users should not see
duplicate sign-in/create-account calls, and logout belongs in a consistently
available account menu or navigation action rather than being repeated on the
page. Destructive or abandoning actions require explicit context.

## Change and verify

Use `@scs/schemas` directly for shared contracts; do not re-export them through
app-local schema files. Keep API access in `src/lib`, typed configuration in
`src/config`, and product composition in `src/components`. Run `test`,
`typecheck`, `lint`, `knip`, and `build`, then exercise user and admin permission
states, form/JSON switching, loading, errors, and mobile navigation.
