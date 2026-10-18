# SCS PDN Monorepo Migration Design

## Purpose

Migrate the SCS PDN websites and services into the existing
`scs-pdn-monorepo` while preserving behavior, deployment boundaries, repository
tooling, and the destination repository's history. The migration uses Bun
workspaces and Turborepo, validates every workspace independently, and defers
shared-code extraction until the imported applications and services work in
their new locations.

The migration must not modify any source repository. It must not migrate the
Git-backed `data.scs.pdn.ac.lk` or `config.scs.pdn.ac.lk` repositories, and it
must not redesign their storage model.

## Source-of-Truth Policy

Every migrated workspace is sourced from a committed Git tree. Files are read
from the commit recorded below, rather than copied from a source checkout's
working directory. This makes the migration reproducible and prevents ignored,
generated, or uncommitted files from entering the baseline accidentally.

`portal.scs.pdn.ac.lk` and `people.scs.pdn.ac.lk` currently have dirty working
trees. Those local changes are explicitly excluded from this baseline
migration. The source checkouts remain untouched, and their local diffs are
deferred for a separate review and migration after the baseline monorepo is
complete.

## Source-State Matrix

| Destination           | Source repository        | Source commit                              | Working-tree policy                                     |
| --------------------- | ------------------------ | ------------------------------------------ | ------------------------------------------------------- |
| `apps/web`            | `scs.pdn.ac.lk`          | `7de460e`                                  | Use committed `HEAD`                                    |
| `apps/portal`         | `portal.scs.pdn.ac.lk`   | `eca1474b7c28535a223bd96a631b83481c91df9f` | Use this committed tree; exclude the dirty working tree |
| `apps/people`         | `people.scs.pdn.ac.lk`   | `fdd3f9edfac553033c89d08eb0419f850ca5aff6` | Use this committed tree; exclude the dirty working tree |
| `apps/projects`       | `projects.scs.pdn.ac.lk` | `3e905bd`                                  | Use committed `HEAD`                                    |
| `services/api`        | `api.scs.pdn.ac.lk`      | `0f5c03e`                                  | Use committed `HEAD`                                    |
| `services/mailer`     | `mailer.scs.pdn.ac.lk`   | `7043928`                                  | Use committed `HEAD`                                    |
| `services/github-app` | `scs-portal-github-app`  | `5a3b824`                                  | Use committed `HEAD`                                    |

Before importing a clean source, its current `HEAD` must still resolve to the
recorded abbreviated commit. If it has moved, the migration stops and records
the mismatch instead of silently importing a newer state.

## Target Architecture

The repository retains these independently deployable workspaces:

```text
apps/web              @scs/web
apps/portal           @scs/portal
apps/people           @scs/people
apps/projects         @scs/projects
services/api          @scs/api
services/mailer       @scs/mailer
services/github-app   @scs/github-app
```

Root Bun workspaces cover `apps/*`, `services/*`, and `packages/*`. Turborepo
orchestrates only scripts that a workspace actually exposes. A missing task is
not replaced with a fake script, and an absent test suite is reported as absent
rather than passing.

The package directories are reserved as follows:

- `packages/eslint-config`: reusable base, Next.js, and Worker ESLint exports
  extracted after all workspace-local configurations pass.
- `packages/tsconfig`: runtime-specific TypeScript bases extracted after local
  type checks pass.
- `packages/ui`: remains empty unless the post-migration duplication audit finds
  components that are genuinely identical and safe across server/client and
  styling boundaries.
- `packages/schemas`: remains empty for the baseline. The published
  `@csc3213-2026-group-b/academic-domain-schemas` dependency stays external.
- `packages/utils`: remains empty unless an actual shared utility is justified
  after behavioral equivalence.

## Migration Matrix

### Keep Inside Each App or Service

- Application and service source code, public assets, tests, local scripts, and
  behavior-specific documentation.
- Workspace `package.json`, renamed to its `@scs/*` package name while retaining
  its scripts and compatible dependency versions.
- `next.config.ts`, `postcss.config.json`, `components.json`, `knip.json`, and
  test configuration while each frontend is validated independently.
- Wrangler configuration, bindings, routes, service-specific TypeScript
  projects, and service ESLint configuration while each Worker is validated.
- Mailer's `vercel.json`, public assets, and runtime-relative static-file
  behavior.
- Environment templates containing names and non-secret examples only.

### Move to the Monorepo Root

- The common Bun minimum-release-age policy.
- One Husky installation and one pre-commit hook.
- Shared Prettier settings and the root lint-staged dispatcher.
- Consolidated `.gitignore`, `.gitattributes`, VS Code recommendations, and a
  monorepo-aware development container.
- The single generated root `bun.lock`.

### Merge at the Monorepo Root

- Root scripts and Turborepo tasks for development, linting, type checking,
  tests, builds, and format checking.
- GitHub Actions checks and manual image-publishing workflows, with workspace
  path filters and stable deployment identities.
- Docker ignore rules for builds whose context is the monorepo root.
- Root documentation, environment setup, deployment prerequisites, and source
  migration notes.

### Extract Only After Independent Validation

- The identical frontend ESLint configuration into
  `@scs/eslint-config/next`.
- Compatible Worker ESLint rules into `@scs/eslint-config/worker`, retaining
  the API and GitHub App's different test and ignore behavior through local
  overrides.
- TypeScript bases into runtime-specific `base`, `nextjs`, `worker`, and `bun`
  configurations without forcing incompatible runtimes together.

### Keep Temporarily During Migration

- Workspace-local ESLint and TypeScript configurations until their baseline
  checks pass.
- Source `.agents` skills, `skills-lock.json`, editor configuration, and
  devcontainer configuration until duplicates and unique tooling are compared.
- Workspace Dockerfiles until monorepo-root build contexts reproduce the
  existing images.

### Remove Only After Proven Redundant

- Nested `bun.lock` files after the root install succeeds.
- Nested Husky internals after the root hook reproduces their behavior.
- Duplicate editor/devcontainer configuration after useful settings are merged.
- Generated or cached output: `node_modules`, `.next`, `.cache`, `.turbo`,
  `.wrangler`, `dist`, coverage, `*.tsbuildinfo`, and generated
  `next-env.d.ts`.
- Repeated configuration files only after the corresponding shared package and
  all consuming workspaces pass their gates.

### Never Import

- Nested `.git` directories.
- Ignored `.env`, `.env.local`, and `.dev.vars` contents.
- Private-key files from the GitHub App source.
- Plaintext secret values found in tracked deployment configuration.
- Files from the dirty `portal` and `people` working trees that are not present
  in their recorded committed trees.

## Security and Environment Handling

The API source contains committed production-looking secret values in its
Wrangler configuration, and the GitHub App source tracks private-key files.
These values are treated as compromised and are not copied into the monorepo.

The migration preserves environment-variable names, public identifiers,
Cloudflare routes, KV binding names and IDs, OAuth redirect URLs, and service
URLs. Sensitive values move to Wrangler secrets, GitHub repository/environment
secrets, Vercel environment variables, or local ignored files as appropriate.
Sanitized example files document every required name without usable secrets.

Migration documentation must include a rotation checklist for the exposed API
credentials and GitHub App keys. Rotation is an operational follow-up and is
not performed by changing or deleting files in the source repositories.

## Workspace Migration Sequence

1. Complete `apps/web` from its recorded Git tree. The existing untracked copy
   may be retained only where its file content matches that tree; missing files
   are imported and changed files are reconciled explicitly.
2. Import `apps/people` from commit `fdd3f9e`, excluding its dirty working tree.
3. Import `apps/projects` from commit `3e905bd`.
4. Import `apps/portal` from commit `eca1474`, excluding its dirty working tree.
5. Import the API, mailer, and GitHub App from their recorded committed trees.
6. Validate every workspace with its local configurations.
7. Extract shared ESLint and TypeScript packages and repeat validation.
8. Centralize repository tooling, repair deployment paths, and consolidate CI.
9. Complete root documentation and run all root orchestration gates.

Each independently verified slice receives a Conventional Commit. A broken
workspace is repaired before its migration commit unless a temporary commit is
needed to preserve recoverable work and is clearly marked as such.

## Type Checking and Testing

Each frontend receives a real `typecheck` script using TypeScript without emit.
Existing test suites are preserved: Projects uses Vitest, the API uses Bun's
test runner, and the GitHub App retains its existing tests. Frontends and the
mailer that currently have no tests are documented as lacking test coverage.
No empty or always-successful test script is added.

Validation for each Next.js application includes dependency resolution, lint,
type checking, production build, and a bounded startup smoke check where
practical. Service validation includes its existing lint/typecheck/test/build
commands and a local runtime smoke check where credentials are not required.

The final root gates are `bun install --frozen-lockfile`, `bun run lint`,
`bun run typecheck`, `bun run test`, `bun run build`, and the configured format
check. Turbo skips workspaces that do not define a requested script.

## Docker and Deployment

Docker builds use the monorepo root as their context so the root lockfile and
workspace graph are available. Each frontend retains an explicit Dockerfile
that installs the root workspace dependencies, builds only its application, and
copies the correct monorepo-shaped Next.js standalone output. Next.js tracing
roots are set to the monorepo root without changing application routes or
runtime configuration.

The existing manual GHCR publishing behavior remains available. Image names
remain the names used by the original repositories instead of becoming the
monorepo repository name. Path-aware checks run for affected workspaces and for
dependants of changed packages. The migration does not invent automatic
deployments for the API, mailer, or GitHub App where no source workflow exists.

Mailer remains independently deployable with Vercel. The API and GitHub App
remain separate Cloudflare Workers with separate Wrangler configurations,
bindings, secrets, and deployment commands.

## Documentation and Final Evidence

The root README documents architecture, prerequisites, Bun installation,
PowerShell commands, per-workspace development and validation, deployment
boundaries, external data/config repositories, environment setup, and the
absence of tests where applicable.

Migration notes record the exact source commits, the excluded dirty working
trees, centralized versus intentionally local configuration, secret and GitHub
setting requirements, Docker and CI changes, unresolved risks, exact commands,
and observed results. Completion is claimed only after those commands have been
run against the final repository state.
