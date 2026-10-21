# Development

## Prerequisites

- Bun 1.4.3
- Git
- local environment files only for integrations being exercised

Install from the repository root:

```powershell
bun install --frozen-lockfile
```

The lockfile is authoritative. Do not run a second package manager in a
workspace.

## Common Commands

```powershell
bun run dev
bun run docs:check
bun run format:check
bun run lint
bun run typecheck
bun run typecheck:test
bun run test
bun run build
```

Filter one package when iterating:

```powershell
bun --filter '@scs/portal' dev
bun --filter '@scs/api' test
bun --filter '@scs/github-app' typecheck
bun --filter '@scs/github-app' typecheck:test
```

Inspect each workspace's `package.json` for additional commands such as Knip,
test watch mode, or deployment. Root Turbo commands invoke only scripts that a
workspace declares.

## Local Hosts and Environment

Copy examples; never edit or commit populated environment files:

```text
apps/web/.env.example
apps/people/.env.example
apps/projects/.env.example
apps/portal/.env.example
services/api/.dev.vars.example
services/github-app/.env.example
services/mailer/.env.example
```

The complete variable catalog, visibility rules, defaults, secrets, and
Cloudflare bindings are in [Environment variables](ENVIRONMENT_VARIABLES.md).
API development uses Wrangler and `.dev.vars`. GitHub App and Mailer retain
Bun entry points for local execution.

## TypeScript and Linting

Workspace TypeScript configurations extend presets in `packages/tsconfig`.
Keep only workspace paths, file sets, references, and runtime-specific
overrides locally. Do not copy compiler policy into each app.

ESLint presets live in `packages/eslint-config`. Use workspace overrides only
for a demonstrated runtime or file-class difference.

## Application Configuration

Runtime and feature settings belong under each workspace's `src/config`
directory. Environment parsing stays in `*.env.config.ts`; grouped behavior
such as authentication limits, polling timeouts, cache lifetimes, and routing
patterns belongs in focused files such as `auth.config.ts` or
`data.config.ts`. Components and service modules consume those typed configs
instead of declaring operational constants locally.

Schema-derived view options and function-local implementation values are not
configuration and stay with their owning domain or component.

## UI Components

Reusable shadcn primitives live only in `packages/ui`. Import explicit
subpaths, for example:

```tsx
import { Button } from '@scs/ui/components/button';
```

Product-specific compositions remain under an app's custom components. `cn`
comes from the `cn` package or the shared UI re-export; do not recreate
`clsx`/`tailwind-merge` helpers in applications.

## Tests

Use the runner declared by the workspace. Bun tests use `bun test`; do not use
Bun's runner to judge a Vitest suite. Run `typecheck:test` where declared so
test-only paths and runtime globals are checked. A missing test script means
coverage is absent.

For behavior changes:

1. Write the focused failing test.
2. Confirm it fails for the intended reason.
3. Implement the minimum change.
4. Run the focused test and the workspace suite.
5. Run lint, typecheck, and build when applicable.

## Documentation

Tracked Markdown must be root `README.md` or live under root `docs`. Filenames
use uppercase snake case, for example `API_CONTRACTS.md`.

```powershell
bun run docs:check
```

Workspace-local generated docs, migration ledgers, and assistant planning
folders are not product documentation.

## Local Agent Skills

`skills-lock.json` is tracked; installed payloads are not.

```powershell
bunx skills experimental_install
```

Run the installer only from the repository root. `.agents` and `.superpowers`
are local/ignored paths and must not be committed.

## Commits

Use Conventional Commits, such as:

```text
feat(api): add cursor pagination
fix(portal): stop duplicate operation polling
docs: update deployment recovery steps
```

The pre-commit hook formats staged supported files. The commit-message hook
rejects nonconforming subjects.
