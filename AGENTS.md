# Agent Instructions

These rules apply to the entire repository. Human instructions for a specific
task take precedence, but repository safety and verification requirements still
apply.

## Before Editing

1. Read `README.md` and the guide relevant to the change.
2. Inspect `git status` and preserve unrelated work.
3. Read the owning workspace's `package.json`, TypeScript configuration, and
   tests before changing behavior.
4. Trace callers and consumers before removing an endpoint, export, dependency,
   environment variable, or compatibility path.

Do not modify the separate data or legacy source repositories unless the task
explicitly includes them.

## Architecture Rules

- Applications and services must remain independently deployable.
- Browser code calls `services/api`; it must not receive GitHub App credentials
  or call private automation routes directly.
- Put shared runtime and transport contracts in `packages/schemas`.
- Put reusable shadcn primitives only in `packages/ui`. Keep composed product
  components in their owning app.
- Extend presets from `packages/tsconfig` and `packages/eslint-config`; do not
  copy central policy into each workspace.
- Keep environment parsing and operational settings in `src/config`. Use T3 Env
  where the workspace already uses it.
- Prefer `@/` and package exports over `../` imports when an alias is available.
  Relative imports are acceptable for tightly coupled files in the same folder
  or where a tool configuration cannot resolve workspace aliases.

## Implementation Rules

- Preserve behavior unless the task explicitly changes a contract.
- Validate untrusted data at the boundary with the owning Zod schema.
- Keep lists bounded and paginated. Avoid N+1 provider or database reads.
- Make externally retried mutations idempotent and protect updates with entity
  revisions where supported.
- Put tests in the workspace's `test` or `tests` directory, not beside source.
- Write comments for invariants, security boundaries, compatibility constraints,
  or non-obvious decisions. Do not narrate obvious syntax.
- Use block comments for multi-line explanations and `//` for a short local
  clarification.
- Assign arrays and objects to named constants before default-exporting them.
- Do not add Docker files or Docker verification unless the task explicitly
  requests them.

## Documentation Rules

- Keep product documentation in root `README.md` or `docs`.
- Root `AGENTS.md` is reserved for repository-wide agent instructions.
- Files under `docs` use `UPPER_SNAKE_CASE.md` names.
- Update documentation in the same commit as a changed command, route,
  environment variable, workflow, deployment step, or architectural boundary.
- Prefer a small Mermaid diagram when it makes a system flow, state machine, or
  ownership boundary easier to understand. Keep prose as the source of detail.
- Remove completed plans and migration diaries once their lasting decisions are
  represented in living documentation.

## Verification

Run the narrowest relevant checks while iterating, then the owning workspace
gate:

```powershell
bun --filter '<workspace>' lint
bun --filter '<workspace>' typecheck
bun --filter '<workspace>' typecheck:test
bun --filter '<workspace>' test
bun --filter '<workspace>' build
```

Only run tasks declared by that workspace. Before finalizing a shared or
repository-wide change, run:

```powershell
bun run docs:check
bun run format:check
bun run lint
bun run typecheck
bun run typecheck:test
bun run test
bun run build
git diff --check
```

Never describe a missing test script as a passing test. Do not bypass a failing
gate; diagnose it and document any credential-dependent validation boundary.

## Git and Concurrent Work

- Use Conventional Commit subjects.
- Commit coherent, verified phases; do not mix unrelated cleanup.
- Never reset, overwrite, or delete another contributor's uncommitted work.
- Do not force-push shared branches.
- Pull requests use affected-workspace checks, while merge queue and `main`
  verify the complete monorepo.
- Keep generated or temporary agent state local and ignored.
