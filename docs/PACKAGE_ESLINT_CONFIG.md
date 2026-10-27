---
title: ESLint configuration package
description: Shared lint presets, Tailwind and import policy, consumer overrides, tests, and change workflow.
---

# ESLint configuration package

`packages/eslint-config` (`@scs/eslint-config`) publishes base, project, Next.js,
and Worker flat-config presets. Workspaces extend the appropriate preset rather
than copying central rules.

The policy covers TypeScript and React correctness, import organization,
workspace aliases, and Tailwind class quality including canonical class forms
and ordering. Local overrides are reserved for generated files, runtime globals,
or a documented framework limitation; they must not broadly disable a shared
rule to silence product code.

Update the config's tests when behavior changes. Run its `test` and `typecheck`
scripts, then lint representative Next.js, Worker, Bun-service, library, and
test files. Rule/plugin dependency versions belong to this package when the
shared preset loads them.

See [ESLint presets](PACKAGES/TOOLING/ESLINT_PRESETS.md) for flat-config
composition, Tailwind project roots, typed Worker rules, and the allowed scope
of local overrides.
