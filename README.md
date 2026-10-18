# SCS PDN Monorepo

This Bun/Turborepo workspace contains the independently deployable SCS PDN
websites and services migrated from their pinned source commits. The baseline
preserves application behavior and deployment boundaries; shared product code
was deliberately not extracted during migration.

## Workspaces

| Path                     | Package              | Runtime                            | Production boundary       |
| ------------------------ | -------------------- | ---------------------------------- | ------------------------- |
| `apps/web`               | `@scs/web`           | Next.js                            | Vercel-compatible web app |
| `apps/people`            | `@scs/people`        | Next.js                            | Vercel-compatible web app |
| `apps/projects`          | `@scs/projects`      | Next.js                            | Vercel-compatible web app |
| `apps/portal`            | `@scs/portal`        | Next.js                            | Vercel-compatible web app |
| `services/api`           | `@scs/api`           | Cloudflare Worker                  | Wrangler deployment       |
| `services/mailer`        | `@scs/mailer`        | Bun/Hono                           | Independent Bun service   |
| `services/github-app`    | `@scs/github-app`    | Bun and Cloudflare-compatible code | Independent service       |
| `packages/schemas`       | `@scs/schemas`       | TypeScript/Zod                     | Shared domain contracts   |
| `packages/eslint-config` | `@scs/eslint-config` | Tooling                            | Shared ESLint presets     |
| `packages/tsconfig`      | `@scs/tsconfig`      | Tooling                            | Shared TypeScript presets |

`data.scs.pdn.ac.lk` and `config.scs.pdn.ac.lk` remain external Git-backed
systems and are not workspaces in this repository.

## Prerequisites and setup

- Bun 1.4.3
- Git
- Provider credentials only when running integrations or deploying

From PowerShell at the repository root:

```powershell
bun --version
bun install --frozen-lockfile
bun run dev
```

Run one workspace with its package filter:

```powershell
bun --filter '@scs/web' dev
bun --filter '@scs/people' dev
bun --filter '@scs/projects' dev
bun --filter '@scs/portal' dev
bun --filter '@scs/api' dev
bun --filter '@scs/mailer' dev
bun --filter '@scs/github-app' dev
bun --filter '@scs/schemas' test
```

Each workspace retains its own package scripts and can be built or started
without invoking unrelated applications. Inspect its `package.json` and local
README for additional maintenance commands.

## Verification

The complete native gate is:

```powershell
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run build
```

Turbo runs only scripts declared by each workspace. Tests currently exist for
Schemas, the shared ESLint package, Projects, API, and GitHub App. A missing test script
is documented as missing coverage, not a passing suite. Pull requests use
affected-workspace CI; pushes to `main` run the full gate.

Commits use the Conventional Commits format. The Husky pre-commit hook runs
lint-staged, and the commit-message hook validates the subject with Commitlint.

Dockerfiles, Compose configuration, devcontainers, and container/image
publishing workflows are intentionally absent. Verification and development
use Bun directly.

## Configuration and deployment

Copy the relevant example file locally and keep the populated file untracked:

- `apps/people/.env.example`
- `apps/portal/.env.example`
- `services/api/.dev.vars.example`
- `services/github-app/.env.example`
- `services/mailer/.env.example`

The four Next.js apps remain separate deployment units. The API uses
`bun --filter '@scs/api' deploy` after its Cloudflare secrets and bindings are
configured. The Mailer and GitHub App remain independently runnable services;
no replacement deployment platform was invented during migration. See
`docs/migration/required-secrets.md` before any deployment.

## Local agent skills

Agent payloads are generated local tooling and are not tracked. Restore the
reconciled set only from the repository root:

```powershell
bunx skills experimental_install
```

The source snapshots, migration decisions, verification evidence, and deferred
work are recorded under `docs/migration`.
