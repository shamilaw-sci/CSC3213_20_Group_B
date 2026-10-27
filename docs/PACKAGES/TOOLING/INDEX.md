---
title: Tooling package internals
description: How the shared TypeScript and ESLint packages distribute repository policy without copying configuration into workspaces.
---

# Tooling package internals

`packages/tsconfig` and `packages/eslint-config` distribute compile-time and
static-analysis policy. They do not produce application runtime code, but a
change can affect every workspace during editing, testing, or building.

| Package              | Policy it owns                                                     |
| -------------------- | ------------------------------------------------------------------ |
| `@scs/tsconfig`      | strictness, target, module resolution, runtime types, JSX          |
| `@scs/eslint-config` | correctness, imports, unused code, Next.js, Tailwind, Worker rules |

Read [TypeScript presets](TYPESCRIPT_PRESETS.md) for compiler inheritance and
[ESLint presets](ESLINT_PRESETS.md) for flat-config composition and consumer
settings.
