# SCS PDN Monorepo

The SCS PDN monorepo contains independently deployable websites and services
for the Department of Statistics and Computer Science, University of
Peradeniya. Bun manages the workspace and Turborepo coordinates shared quality
gates without merging deployment boundaries.

## Workspaces

| Path                     | Package              | Purpose                             |
| ------------------------ | -------------------- | ----------------------------------- |
| `apps/web`               | `@scs/web`           | Department website                  |
| `apps/people`            | `@scs/people`        | Public people directory             |
| `apps/projects`          | `@scs/projects`      | Public project directory            |
| `apps/portal`            | `@scs/portal`        | Authenticated management portal     |
| `services/api`           | `@scs/api`           | Public and authenticated API        |
| `services/github-app`    | `@scs/github-app`    | Git-backed change automation        |
| `services/mailer`        | `@scs/mailer`        | Transactional email service         |
| `packages/schemas`       | `@scs/schemas`       | Shared runtime and TypeScript types |
| `packages/ui`            | `@scs/ui`            | Shared shadcn UI primitives         |
| `packages/eslint-config` | `@scs/eslint-config` | Shared ESLint presets               |
| `packages/tsconfig`      | `@scs/tsconfig`      | Shared TypeScript presets           |

Public data and access configuration remain separate Git-backed systems. They
are consumed by this monorepo but are not workspaces inside it.

## Setup

Requirements:

- Bun 1.4.3
- Git
- provider credentials only for integration or deployment work

```powershell
bun install --frozen-lockfile
bun run dev
```

Run one workspace by package name:

```powershell
bun --filter '@scs/portal' dev
bun --filter '@scs/api' dev
bun --filter '@scs/github-app' dev
```

## Verification

```powershell
bun run docs:check
bun run format:check
bun run lint
bun run typecheck
bun run typecheck:test
bun run test
bun run build
```

Turbo invokes only scripts declared by each workspace. A workspace without a
test script has missing automated coverage; it is not treated as a passing test
suite.

Commits use Conventional Commits. Husky runs lint-staged before commits and
Commitlint validates commit messages.

## Shared Foundations

- `packages/ui` is the only source of reusable shadcn primitives.
- `packages/schemas` owns shared domain and transport contracts.
- `packages/tsconfig` owns compiler presets.
- `packages/eslint-config` owns lint presets.
- Product-specific components and domain behavior stay in their owning app or
  service until reuse is proven.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API contracts](docs/API_CONTRACTS.md)
- [Development](docs/DEVELOPMENT.md)
- [Environment variables](docs/ENVIRONMENT_VARIABLES.md)
- [Operations](docs/OPERATIONS.md)
- [Schemas](docs/SCHEMAS.md)
- [Security](docs/SECURITY.md)
- [Optimization design](docs/REPOSITORY_OPTIMIZATION_DESIGN.md)
- [Optimization plan](docs/REPOSITORY_OPTIMIZATION_PLAN.md)
- [Optimization completion report](docs/OPTIMIZATION_COMPLETION_REPORT.md)

Tracked Markdown belongs in the repository root or root `docs` directory and
uses uppercase snake-case filenames. Installed agent skills and generated
assistant work are local-only. Restore the locked skill set from the root with:

```powershell
bunx skills experimental_install
```

Docker is not part of the current development or verification workflow.
