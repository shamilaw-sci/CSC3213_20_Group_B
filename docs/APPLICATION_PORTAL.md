---
title: Portal application
description: Authenticated workflows, route areas, API boundary, form modes, permissions, and verification for apps/portal.
---

# Portal application

`apps/portal` (`@scs/portal`) is the authenticated management interface. It
calls `services/api`; it never receives GitHub App credentials or calls private
automation routes directly.

For implementation-level behavior, use the
[Portal internals](APPLICATIONS/PORTAL/INDEX.md) guide:

- [Routing and access](APPLICATIONS/PORTAL/ROUTING_AND_ACCESS.md) separates
  cookie routing hints from API-backed authorization;
- [Editor state and mutations](APPLICATIONS/PORTAL/EDITOR_STATE_AND_MUTATIONS.md)
  explains form, review, JSON, validation, and operation polling;
- [Data loading and failures](APPLICATIONS/PORTAL/DATA_LOADING_AND_FAILURES.md)
  covers server fetch aggregation, nullable records, redirects, and loading
  boundaries.

## Route areas

- `/login`, `/signup`, `/privacy`, and `/tos` cover entry and policy.
- `/.well-known/security.txt` serves the authoritative RFC 9116 document;
  `/privacy#security-reporting` is its reporting policy.
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
