# Continuous Integration

The monorepo uses one verification workflow for every pull request, merge
queue entry, and push to `main`. It deliberately has no path filters: changes
to shared configuration, documentation, or repository policy can affect every
workspace and must not bypass required checks.

## Execution Model

Each run installs the locked Bun dependency graph once, then executes the
least expensive repository-wide checks before workspace compilation:

1. documentation policy and link validation;
2. repository policy tests;
3. formatting validation;
4. pull request title validation using Conventional Commits;
5. workspace lint, source typecheck, test-source typecheck, test, and build
   tasks.

Pull requests use Turbo's affected-workspace selection. Merge queue entries
and pushes to `main` run the complete monorepo gate. Superseded pull request
runs are cancelled, while merge queue and `main` runs are never cancelled by
concurrency policy.

The workflow caches Bun downloads and Turbo task output. The lockfile remains
the source of truth; dependency installation always uses `--frozen-lockfile`.

## Local Verification

Run the repository policy checks before opening a pull request:

```powershell
bun run docs:check
bun run test:repo
bun run format:check
```

Run the complete workspace gate when changing shared packages, configuration,
or release-critical behavior:

```powershell
bun run lint
bun run typecheck
bun run typecheck:test
bun run test
bun run build
```

To inspect Turbo's planned tasks without running them:

```powershell
bunx turbo run lint typecheck typecheck:test test build --dry=json
```

A workspace-specific `typecheck:test` task keeps test-only imports, fixtures,
and runtime types inside the CI type boundary. It currently applies to the API,
GitHub App, Projects app, and schema package.

A workspace without a `test` task has missing automated coverage; it is not a
passing test result. Add the task and meaningful tests before relying on CI as
evidence for that workspace.

## Concurrent Contributions

Keep changes scoped and rebase or merge the latest target branch before final
verification. Do not force-push over another contributor's work. The merge
queue is the final authority for detecting conflicts and cross-branch failures
against the current `main` state.
