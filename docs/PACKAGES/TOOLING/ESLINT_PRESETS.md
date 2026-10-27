---
title: ESLint presets
description: Base, Next.js, Worker, TypeScript resolver, and Tailwind settings plus the rules for local overrides and verification.
---

# ESLint presets

The ESLint package exposes flat-config arrays for base, Next.js, and Worker
policy plus helpers that bind resolution and Tailwind analysis to the consuming
workspace.

## Preset composition

| Export            | Main responsibility                                             |
| ----------------- | --------------------------------------------------------------- |
| `base`            | import sorting, unused imports, console policy, Prettier        |
| `next`            | Next TypeScript and Core Web Vitals, base, Tailwind correctness |
| `worker`          | typed TypeScript, Worker globals, imports, promises, security   |
| `project` helpers | workspace TSConfig resolver and Tailwind CSS entry point        |

Base treats unused imports as errors, intentionally ignored underscore-prefixed
values as allowed, other unused values and explicit `any` as warnings, and
non-approved console calls as warnings. Prettier is last so formatting rules do
not conflict with the formatter.

The Next preset enables `eslint-plugin-better-tailwindcss` correctness and
enforces canonical classes. Each application supplies its own `cwd` and global
CSS entry point so Tailwind v4 tokens and scanned classes resolve in the right
workspace. Shared UI disables unknown-class checking because its semantic
utilities are supplied by consumers; it does not disable conflicting or
canonical-class checks.

The Worker preset uses type-aware rules for source, including unresolved
imports, floating promises, misused promises, and consistent type imports. It
provides browser and Worker globals; Bun or Node services add their own globals
locally. `security/detect-object-injection` is disabled because it produces
unusable noise for ordinary typed property access, while the rest of the
security plugin is registered for explicit rules in the preset or a consumer.

## Local overrides

Local configuration may add generated-file ignores, runtime globals, test-only
non-type-aware files, a Tailwind entry point, or a narrow documented framework
exception. It must not copy central rules or disable a rule across product code
to avoid fixing violations.

Config tests assert exported policy and inspect representative Web, Projects,
UI, and GitHub App consumers. After changing a preset, run the config package's
test and typecheck plus lint in representative Next.js, UI, Worker, Bun service,
and test workspaces.
