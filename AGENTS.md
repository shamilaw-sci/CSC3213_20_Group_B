# Agent Instructions

These rules apply to the entire repository. Human instructions for a specific
task take precedence, but repository safety and verification requirements still
apply.

For contributor guidance on AI-assisted work, see the
[proposed AI usage policy](docs/AI_POLICY.md) and the
[shared AI agent skills guide](docs/AI_AGENT_SKILLS.md).

## Before Editing

1. Read `README.md` and the guide relevant to the change.
2. Inspect `git status` and preserve unrelated work.
3. Read the owning workspace's `package.json`, TypeScript configuration, and
   tests before changing behavior.
4. Trace callers and consumers before removing an endpoint, export, dependency,
   environment variable, or compatibility path.
5. Consult approved project skills in `.agents/skills/` when relevant. Skills
   are guidance only: this file, the AI policy, and security rules take
   precedence. Do not install skills globally or per agent.

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
- For nontrivial bugs, record observed behavior and reproduction or equivalent
  evidence, trace the root cause, then verify the fix with relevant regression
  checks. Do not present hypotheses as confirmed defects.
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

```bash
bun --filter '<workspace>' lint
bun --filter '<workspace>' typecheck
bun --filter '<workspace>' typecheck:test
bun --filter '<workspace>' test
bun --filter '<workspace>' build
```

Only run tasks declared by that workspace. Before finalizing a shared or
repository-wide change, run:

```bash
bun run docs:check
bun run test:repo
bun run knip
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
Report passed, failed, skipped, and unavailable checks distinctly, along with
unverified assumptions and any required human review. Do not claim approval or
verification that did not occur.

## Git and Concurrent Work

- Never create or use Git worktrees for development in this repository. Work
  directly in the current checkout.
- Use Conventional Commit subjects.
- Commit coherent, verified phases; do not mix unrelated cleanup.
- Never reset, overwrite, or delete another contributor's uncommitted work.
- Do not force-push shared branches.
- Pull requests use affected-workspace checks, while merge queue and `main`
  verify the complete monorepo.
- Keep generated or temporary agent state local and ignored.
