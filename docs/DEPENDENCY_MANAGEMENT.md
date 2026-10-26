---
title: Dependency management
description: Bun workspace installation, version alignment, updates, package ownership, and lockfile verification.
---

# Dependency management

The repository uses Bun workspaces and one root `bun.lock`. Install and update
dependencies from the repository root. Do not add npm, pnpm, or Yarn lockfiles.

## Adding a dependency

Add a runtime dependency to the workspace that imports it directly. Shared
packages are referenced with `workspace:*`. Type-only and build/test tools
belong in `devDependencies`. Keep versions aligned with equivalent workspaces
unless a concrete compatibility constraint requires otherwise.

```powershell
bun add --filter '@scs/example' package-name
bun add --dev --filter '@scs/example' package-name
```

After an update, inspect both the workspace manifest and lockfile. Run the
workspace gate, `bun run knip`, and any build whose bundler or runtime changed.
Framework updates require checking official migration notes and deployment
adapters, not only local compilation.

## Removing a dependency

Trace imports, configuration, generated code, tests, and runtime consumers
before removal. Knip is evidence, not sole authority: configuration-driven and
provider-loaded dependencies may not appear as static imports. Remove the
manifest entry and verify a frozen install plus the owning workspace gate.
