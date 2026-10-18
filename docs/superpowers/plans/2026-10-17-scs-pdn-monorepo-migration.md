# SCS PDN Monorepo Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate seven SCS PDN applications and services from pinned committed Git trees into a verified Bun/Turborepo monorepo without modifying the source repositories or changing deployment boundaries.

**Architecture:** Import one committed source tree at a time, retain workspace-local behavior and configuration until that workspace passes, then extract only proven shared configuration. Root tooling, Docker, CI, and documentation are consolidated after every workspace has a green independent baseline.

**Tech Stack:** Bun 1.4.3, Turborepo 2.11.9, Next.js 16, React 19, TypeScript, ESLint 9, Tailwind CSS 4, Vitest, Cloudflare Workers/Wrangler, Hono, Vercel, Docker, GitHub Actions, Husky, and lint-staged.

**Spec:** `docs/superpowers/specs/2026-10-17-scs-pdn-monorepo-migration-design.md`

## Global Constraints

- Use only the source commits recorded in the approved specification; never read product files from the dirty `portal` or `people` working trees.
- Do not modify, clean, stash, commit, or switch branches in any source repository.
- Do not migrate `data.scs.pdn.ac.lk` or `config.scs.pdn.ac.lk`.
- Use Bun and the single root `bun.lock`; do not introduce npm, pnpm, or Yarn lockfiles.
- Preserve independent deployment for every app and service.
- Preserve actual dependency versions during import; align versions only after the baseline passes and only where compatibility is demonstrated.
- Keep `@csc3213-2026-group-b/academic-domain-schemas` at version `5.1.0` and external during the baseline migration.
- Never copy ignored environment files, committed plaintext secret values, or GitHub App private keys.
- Report a missing test suite as missing coverage; never add an always-successful placeholder test script.
- Commit only after the current task's verification commands pass, using Conventional Commits.

## Review Focus

- Dirty-tree exclusion: destination product files must match the pinned `portal` and `people` Git trees, not their local checkouts; Task 1 records the dirty paths and Tasks 3 and 5 compare imports against archived committed trees.
- Secret exclusion: API plaintext secrets and GitHub App private keys must never enter destination history; Tasks 6 and 8 add sanitized configuration and scan staged files before commit.
- Root-relative runtime paths: Docker standalone output and the mailer favicon must still resolve from workspace-specific commands; Tasks 7 and 12 exercise those paths.
- Shared configuration resolution: ESLint and TypeScript presets must resolve from every runtime without weakening rules; Tasks 9 and 10 run every consumer after extraction.
- Deployment identity: monorepo workflows must continue publishing the original GHCR image names and retain service-specific secrets/bindings; Task 12 checks workflow mappings and Docker labels explicitly.

---

### Task 1: Freeze Source Evidence and Finish Root Bootstrap

**Files:**

- Modify: `package.json`
- Modify: `turbo.json`
- Modify: `.gitignore`
- Create: `.gitattributes`
- Create: `bunfig.toml`
- Create: `docs/migration/source-state.md`
- Create: `docs/migration/migration-matrix.md`

**Interfaces:**

- Consumes: approved design commit `4721d23` and the seven local source repositories.
- Produces: pinned source evidence, Bun 1.4.3 workspace metadata, and root task names used by every later task.

- [ ] **Step 1: Verify all source commits without changing source checkouts**

Run `git -C <source> rev-parse HEAD` and `git -C <source> cat-file -t <pinned-commit>` for each source. Assert that the two full hashes in the spec resolve to `commit`, the five abbreviated clean-source hashes still match their current `HEAD`, and `git status --short` records dirty paths only for `portal` and `people`.

- [ ] **Step 2: Write the source evidence and classification documents**

In `docs/migration/source-state.md`, record each source path, full commit hash, clean/dirty state, and the names of excluded dirty paths without copying their contents. In `docs/migration/migration-matrix.md`, expand the approved matrix to the audited root files, classifying package manifests, lockfiles, Bun config, TypeScript, ESLint, Prettier, Next.js, PostCSS, Vitest, Wrangler, Docker, devcontainer, VS Code, workflows, hooks, environment templates, scripts, docs, `.agents`, and generated files.

- [ ] **Step 3: Make the root bootstrap match the installed toolchain**

Set `packageManager` to `bun@1.4.3`; retain workspaces `apps/*`, `services/*`, and `packages/*`; add `format:check`; and keep Turbo tasks optional by relying on package script discovery. Add the shared seven-day release-age policy to root `bunfig.toml`, with the schema package exemption. Expand ignores for all generated Next.js, Worker, coverage, cache, TypeScript-build, environment, and private-key files.

- [ ] **Step 4: Validate the bootstrap without resolving the partial web workspace**

Run:

```powershell
bun --version
bunx turbo --version
git diff --check
```

Expected: Bun reports `1.4.3`, Turbo reports `2.11.9`, and
`git diff --check` is clean. The first root install is deliberately deferred to
Task 2 because the existing untracked `apps/web` partial copy is already visible
to Bun workspace discovery and must be reconciled before generating its lock
entries.

- [ ] **Step 5: Commit**

```powershell
git add package.json turbo.json .gitignore .gitattributes bunfig.toml bun.lock docs/migration
git commit -m "chore: prepare verified monorepo migration"
```

### Task 2: Migrate and Validate the Public Web App

**Files:**

- Create/replace from `scs.pdn.ac.lk@7de460e`: `apps/web/src/**`, `apps/web/README.md`, `apps/web/components.json`, `apps/web/postcss.config.json`, `apps/web/knip.json`, `apps/web/.agents/**`, `apps/web/skills-lock.json`, `apps/web/.npmrc.example`
- Modify from source: `apps/web/package.json`
- Modify: `apps/web/tsconfig.json`
- Modify: `apps/web/next.config.ts`
- Keep temporarily: `apps/web/eslint.config.ts`, `apps/web/Dockerfile`, `apps/web/.dockerignore`
- Modify: `bun.lock`
- Modify: `docs/migration/verification.md`

**Interfaces:**

- Consumes: root Bun workspace and source commit `7de460e`.
- Produces: independently lintable, type-checkable, buildable package `@scs/web`.

- [ ] **Step 1: Stage the committed tree and compare the existing partial import**

Use `git archive 7de460e` from the source repository into a temporary directory. Hash-compare the existing untracked `apps/web/src/**` and local configuration against that archive. Record any mismatch before replacing it; expected product-source mismatch count is zero.

- [ ] **Step 2: Import only committed product and local-tooling files**

Populate the listed paths from the archive. Do not import `.git`, `bun.lock`, `.husky`, `.github`, `.devcontainer`, or `.vscode`. Preserve `.agents` temporarily. Rename the package to `@scs/web`, remove its workspace-local `prepare` script and package-level Prettier/lint-staged blocks only after their values are captured in the migration matrix, and add `typecheck: "tsc --noEmit"`.

- [ ] **Step 3: Repair monorepo-local configuration without extracting shared config**

Keep `@/* -> ./src/*`; make generated/cache excludes workspace-local; add `outputFileTracingRoot` pointing two directories above the app while retaining `globalNotFound` and Docker-only standalone output. Do not change routes, components, styles, or runtime environment semantics.

- [ ] **Step 4: Install and validate the app**

Run:

```powershell
bun install
bun --filter '@scs/web' lint
bun --filter '@scs/web' typecheck
bun --filter '@scs/web' build
```

Expected: all commands exit zero. Record that the source contains no test files and therefore has no test gate.

- [ ] **Step 5: Perform a bounded startup smoke check**

Start `bun --filter '@scs/web' dev` on an unused local port, request `/`, and stop the process. Expected: the server becomes ready and returns a non-5xx response.

- [ ] **Step 6: Commit**

```powershell
git add apps/web bun.lock docs/migration/verification.md
git commit -m "feat(web): migrate public site into monorepo"
```

### Task 3: Migrate and Validate People from Committed State

**Files:**

- Create from `people.scs.pdn.ac.lk@fdd3f9e`: `apps/people/src/**`, `apps/people/public/**`, `apps/people/docker/**`, `apps/people/README.md`, `apps/people/ROUTES.md`, `apps/people/components.json`, `apps/people/postcss.config.json`, `apps/people/knip.json`, `apps/people/.env.example`, `apps/people/.agents/**`, `apps/people/skills-lock.json`
- Create then adapt: `apps/people/package.json`, `apps/people/tsconfig.json`, `apps/people/next.config.ts`, `apps/people/eslint.config.ts`, `apps/people/Dockerfile`, `apps/people/.dockerignore`
- Modify: `bun.lock`
- Modify: `docs/migration/verification.md`

**Interfaces:**

- Consumes: source commit `fdd3f9edfac553033c89d08eb0419f850ca5aff6` only.
- Produces: independently validated package `@scs/people`; explicitly excludes all dirty route-generalization work.

- [ ] **Step 1: Import the pinned Git archive**

Archive exactly `fdd3f9edfac553033c89d08eb0419f850ca5aff6` to a temporary directory and copy the listed committed paths. Rename the package to `@scs/people`, remove local Husky ownership, and add `typecheck: "tsc --noEmit"`.

- [ ] **Step 2: Prove dirty files were excluded**

For every dirty path recorded in `docs/migration/source-state.md`, compare `apps/people/<path>` with `git show fdd3f9e:<path>` or assert absence when the path did not exist at that commit. Expected: every destination path matches the committed tree, including the original subject-specific student routes.

- [ ] **Step 3: Apply only path/configuration repairs**

Preserve `NEXT_PUBLIC_PEOPLE_DATA_BASE_URL`, `NEXT_PUBLIC_PROJECTS_DATA_BASE_URL`, `NEXT_PUBLIC_PROJECTS_SITE_URL`, and `NEXT_PUBLIC_SITE_URL`. Add the monorepo tracing root while keeping existing standalone/Docker behavior and local aliases.

- [ ] **Step 4: Install and validate**

```powershell
bun install
bun --filter '@scs/people' lint
bun --filter '@scs/people' typecheck
bun --filter '@scs/people' build
```

Expected: all commands exit zero. Record that no test suite exists. Smoke-check `/` and one committed student route with non-5xx responses where external data availability permits; distinguish dependency failure from application startup failure.

- [ ] **Step 5: Commit**

```powershell
git add apps/people bun.lock docs/migration
git commit -m "feat(people): migrate directory from committed baseline"
```

### Task 4: Migrate and Validate Projects

**Files:**

- Create from `projects.scs.pdn.ac.lk@3e905bd`: `apps/projects/src/**`, `apps/projects/public/**`, `apps/projects/tests/**`, `apps/projects/README.md`, `apps/projects/components.json`, `apps/projects/postcss.config.json`, `apps/projects/knip.json`, `apps/projects/vitest.config.ts`, `apps/projects/tsconfig.test.json`, `apps/projects/.agents/**`, `apps/projects/skills-lock.json`
- Create then adapt: `apps/projects/package.json`, `apps/projects/tsconfig.json`, `apps/projects/next.config.ts`, `apps/projects/eslint.config.ts`, `apps/projects/Dockerfile`, `apps/projects/.dockerignore`
- Modify: `bun.lock`
- Modify: `docs/migration/verification.md`

**Interfaces:**

- Consumes: source commit `3e905bd` and the external schema package.
- Produces: tested package `@scs/projects` with preserved Vitest aliases and setup.

- [ ] **Step 1: Import the committed tree and adapt package identity**

Import the listed paths from a `git archive 3e905bd`, rename to `@scs/projects`, remove local Husky ownership, and add `typecheck: "tsc --noEmit"` plus `typecheck:test: "tsc -p tsconfig.test.json --noEmit"`.

- [ ] **Step 2: Preserve test and runtime resolution**

Keep `@/*` and `@tests/*` relative to the workspace. Preserve the Vitest jsdom environment, setup file, and all three source test files. Add only the monorepo tracing-root change to Next.js configuration.

- [ ] **Step 3: Install and validate**

```powershell
bun install
bun --filter '@scs/projects' lint
bun --filter '@scs/projects' typecheck
bun --filter '@scs/projects' typecheck:test
bun --filter '@scs/projects' test
bun --filter '@scs/projects' build
```

Expected: lint and both TypeScript projects pass, Vitest discovers and passes the existing tests, and Next.js builds.

- [ ] **Step 4: Commit**

```powershell
git add apps/projects bun.lock docs/migration/verification.md
git commit -m "feat(projects): migrate projects site into monorepo"
```

### Task 5: Migrate and Validate Portal from Committed State

**Files:**

- Create from `portal.scs.pdn.ac.lk@eca1474`: `apps/portal/src/**`, `apps/portal/public/**`, `apps/portal/assets/**`, `apps/portal/scripts/**`, `apps/portal/docs/**`, `apps/portal/README.md`, `apps/portal/components.json`, `apps/portal/postcss.config.json`, `apps/portal/knip.json`, `apps/portal/.env.example`, `apps/portal/.agents/**`, `apps/portal/skills-lock.json`
- Create then adapt: `apps/portal/package.json`, `apps/portal/tsconfig.json`, `apps/portal/next.config.ts`, `apps/portal/eslint.config.ts`, `apps/portal/Dockerfile`, `apps/portal/.dockerignore`
- Modify: `bun.lock`
- Modify: `docs/migration/verification.md`

**Interfaces:**

- Consumes: source commit `eca1474b7c28535a223bd96a631b83481c91df9f` only.
- Produces: independently validated package `@scs/portal`; excludes the dirty `ProjectManagementPage.tsx` changes.

- [ ] **Step 1: Import the pinned Git archive**

Import the listed paths from exactly `eca1474b7c28535a223bd96a631b83481c91df9f`, rename to `@scs/portal`, remove local Husky ownership, and add `typecheck: "tsc --noEmit"`.

- [ ] **Step 2: Prove the dirty portal edit was excluded**

Compare `apps/portal/src/components/custom/project-management-page/ProjectManagementPage.tsx` byte-for-byte with `git show eca1474:src/components/custom/project-management-page/ProjectManagementPage.tsx`. Expected: identical committed content.

- [ ] **Step 3: Preserve scripts and environment contracts**

Keep `generate:assets` and its `scripts/**` paths workspace-relative. Preserve all documented portal variables and the external API/people-data contracts. Add only monorepo tracing and generated-path repairs.

- [ ] **Step 4: Install and validate**

```powershell
bun install
bun --filter '@scs/portal' lint
bun --filter '@scs/portal' typecheck
bun --filter '@scs/portal' build
```

Expected: all commands exit zero. Record that no test suite exists. Smoke-check `/` without requiring authenticated mutations or live external writes.

- [ ] **Step 5: Commit**

```powershell
git add apps/portal bun.lock docs/migration/verification.md
git commit -m "feat(portal): migrate portal from committed baseline"
```

### Task 6: Migrate and Validate the Cloudflare API

**Files:**

- Create from `api.scs.pdn.ac.lk@0f5c03e`: `services/api/src/**`, `services/api/test/**`, `services/api/docs/**`, `services/api/README.md`, `services/api/knip.json`, `services/api/.agents/**`, `services/api/skills-lock.json`
- Create then adapt: `services/api/package.json`, `services/api/eslint.config.ts`, `services/api/tsconfig.base.json`, `services/api/tsconfig.json`, `services/api/tsconfig.node.json`, `services/api/tsconfig.test.json`, `services/api/tsconfig.worker.json`, `services/api/tsconfig.eslint.json`, `services/api/wrangler.jsonc`
- Create: `services/api/.dev.vars.example`
- Modify: `bun.lock`
- Modify: `docs/migration/verification.md`
- Modify: `docs/migration/required-secrets.md`

**Interfaces:**

- Consumes: source commit `0f5c03e`, schema package `5.1.0`, Cloudflare bindings, mailer URL, and GitHub App URL.
- Produces: secure, independently deployable Worker package `@scs/api` with nine preserved tests.

- [ ] **Step 1: Import committed code and non-secret configuration**

Import product, tests, docs, and local configurations from `0f5c03e`; rename to `@scs/api`; remove local Husky ownership. Recreate `wrangler.jsonc` with the same Worker name, entrypoint, compatibility date, custom domain, public variables, KV binding names/IDs, and observability settings, but omit every sensitive plaintext value.

- [ ] **Step 2: Define secure local and deployment inputs**

Create `.dev.vars.example` with placeholders for `JWT_SECRET`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_SECRET`, `MAILER_API_KEY`, `GITHUB_APP_INTERNAL_SECRET`, and `CONFIG_ACCESS_TOKEN_SECRET`. Document the exact `wrangler secret put <NAME>` commands and rotation requirement in `docs/migration/required-secrets.md`. Keep `GOOGLE_CLIENT_ID`, `GITHUB_CLIENT_ID`, both redirect URIs, `JWT_ISSUER`, `MAILER_API_URL`, `GITHUB_APP_API_URL`, `CONFIG_DATA_BASE_URL`, and `DATA_PUBLIC_BASE_URL` as non-secret Wrangler variables.

- [ ] **Step 3: Run the secret regression scan before staging**

Scan `services/api` and staged changes for the known secret field names paired with non-placeholder literal values, private-key markers, `.dev.vars`, and `.env` files. Expected: only templates/documentation and runtime identifier references match; no usable secret value is staged.

- [ ] **Step 4: Install and validate**

```powershell
bun install
bun --filter '@scs/api' typecheck
bun --filter '@scs/api' typecheck:test
bun --filter '@scs/api' lint
bun --filter '@scs/api' test
bun --filter '@scs/api' build
```

Expected: all existing unit and characterization tests pass, both TypeScript projects pass, ESLint rules remain enabled, and Wrangler builds without deploying.

- [ ] **Step 5: Commit**

```powershell
git add services/api bun.lock docs/migration
git commit -m "feat(api): migrate worker with secure bindings"
```

### Task 7: Migrate and Validate the Mailer

**Files:**

- Create from `mailer.scs.pdn.ac.lk@7043928`: `services/mailer/src/**`, `services/mailer/public/**`, `services/mailer/docs/**`, `services/mailer/README.md`, `services/mailer/.env.example`, `services/mailer/vercel.json`
- Create then adapt: `services/mailer/package.json`, `services/mailer/tsconfig.json`
- Modify: `bun.lock`
- Modify: `docs/migration/verification.md`

**Interfaces:**

- Consumes: source commit `7043928`, SMTP environment variables, and `MAILER_API_KEY`.
- Produces: independently runnable package `@scs/mailer` with preserved Hono/Nodemailer behavior and Vercel deployment.

- [ ] **Step 1: Import the committed tree and adapt package identity**

Import source, public assets, docs, template, and Vercel configuration from `7043928`; rename to `@scs/mailer`; remove local Husky ownership. Retain `dev`, `start`, `typecheck`, and `check`; do not invent lint, test, or build scripts the service does not support.

- [ ] **Step 2: Verify workspace-relative static assets**

Keep `serveStatic({ path: './public/favicon.ico' })` and prove filtered Bun scripts execute with `services/mailer` as their working directory. If Bun does not provide that guarantee, replace the path with an `import.meta.dir`-derived absolute path and add a small Bun test that asserts the favicon route returns the asset.

- [ ] **Step 3: Validate**

```powershell
bun install
bun --filter '@scs/mailer' typecheck
bun --filter '@scs/mailer' check
```

Expected: both commands exit zero. Start the service with placeholder-safe local configuration and request `/favicon.ico` plus a non-mutating health/root route. Record that the source has no test suite unless Step 2 required the focused regression test.

- [ ] **Step 4: Commit**

```powershell
git add services/mailer bun.lock docs/migration/verification.md
git commit -m "feat(mailer): migrate transactional mail service"
```

### Task 8: Migrate and Validate the GitHub App

**Files:**

- Create from `scs-portal-github-app@5a3b824`: `services/github-app/src/**`, `services/github-app/tests/**`, `services/github-app/docs/**`, `services/github-app/README.md`, `services/github-app/knip.json`, `services/github-app/.env.example`
- Create then adapt: `services/github-app/package.json`, `services/github-app/eslint.config.ts`, `services/github-app/tsconfig.base.json`, `services/github-app/tsconfig.json`, `services/github-app/tsconfig.test.json`, `services/github-app/tsconfig.worker.json`, `services/github-app/tsconfig.eslint.json`, `services/github-app/wrangler.jsonc`
- Modify: `bun.lock`
- Modify: `docs/migration/verification.md`
- Modify: `docs/migration/required-secrets.md`

**Interfaces:**

- Consumes: source commit `5a3b824`, GitHub App credentials, data/config repository names, and internal caller secret.
- Produces: secure package `@scs/github-app` with three preserved tests and no private-key material.

- [ ] **Step 1: Import the committed tree with a denylist**

Import the listed files from `5a3b824`; never extract `keys/**`, any `*.pem`, `.git`, nested lockfile, or local hook. Rename to `@scs/github-app` and keep its Bun local server plus Wrangler build behavior.

- [ ] **Step 2: Preserve configuration contracts securely**

Retain `GITHUB_APP_ID`, `GITHUB_INSTALLATION_ID`, `GITHUB_OWNER`, repository names, `GITHUB_PRIVATE_KEY`, `X_INTERNAL_SECRET`, and `PORT` in the sanitized template/documentation. Preserve the Worker name, entrypoint, routes, compatibility date, and non-secret vars from Wrangler without embedding credentials.

- [ ] **Step 3: Run the private-key regression scan**

Scan the complete Git index for `BEGIN .*PRIVATE KEY`, tracked `*.pem`, `services/github-app/keys`, ignored `.env` files, and non-placeholder internal secrets. Expected: no private key or usable credential is tracked.

- [ ] **Step 4: Install and validate**

```powershell
bun install
bun --filter '@scs/github-app' typecheck
bun --filter '@scs/github-app' typecheck:test
bun --filter '@scs/github-app' lint
bun --filter '@scs/github-app' test
bun --filter '@scs/github-app' build
```

Expected: all existing tests pass and Wrangler builds without deploying or contacting mutable GitHub endpoints.

- [ ] **Step 5: Commit**

```powershell
git add services/github-app bun.lock docs/migration
git commit -m "feat(github-app): migrate repository automation service"
```

### Task 9: Extract Shared ESLint Configuration

**Files:**

- Create: `packages/eslint-config/package.json`
- Create: `packages/eslint-config/base.ts`
- Create: `packages/eslint-config/next.ts`
- Create: `packages/eslint-config/worker.ts`
- Create: `packages/eslint-config/tsconfig.json`
- Create: `packages/eslint-config/test/config-exports.test.ts`
- Modify: `apps/*/eslint.config.ts`
- Modify: `services/api/eslint.config.ts`
- Modify: `services/github-app/eslint.config.ts`
- Modify: affected workspace `package.json` files
- Modify: `bun.lock`

**Interfaces:**

- Consumes: four passing identical frontend configs and two passing Worker configs.
- Produces: `@scs/eslint-config/base`, `@scs/eslint-config/next`, and `@scs/eslint-config/worker`; thin local wrappers retain runtime-specific ignores and test rules.

- [ ] **Step 1: Add characterization assertions for exported rule sets**

Add a `test: "bun test"` script and a focused Bun test that loads each export and verifies the current rules remain present: import sorting, unused-import removal, Next core-web-vitals/TypeScript, Worker security/import rules, typed promise rules, and Prettier compatibility. Assert the GitHub App test override still disables type-aware linting for `tests/**/*.ts`.

- [ ] **Step 2: Implement the shared package**

Move only identical rules into the three exports. Keep app-relative global ignores in thin local files, retain API `.wrangler`/`.cache` ignores, and retain the GitHub App's unused-disable and test overrides. Declare all ESLint plugins/configs in the shared package and reference it with `workspace:*` from consumers.

- [ ] **Step 3: Validate every consumer**

```powershell
bun install
bun run lint
bun --filter '@scs/eslint-config' test
```

Expected: the characterization assertions and all six lint-capable workspaces pass without disabling or downgrading rules. Mailer remains format/typecheck-only because its source has no ESLint setup.

- [ ] **Step 4: Commit**

```powershell
git add packages/eslint-config apps services package.json bun.lock
git commit -m "refactor(eslint): centralize shared configurations"
```

### Task 10: Extract Shared TypeScript Configuration

**Files:**

- Create: `packages/tsconfig/package.json`
- Create: `packages/tsconfig/base.json`
- Create: `packages/tsconfig/nextjs.json`
- Create: `packages/tsconfig/worker.json`
- Create: `packages/tsconfig/bun.json`
- Modify: `apps/*/tsconfig.json`
- Modify: `apps/projects/tsconfig.test.json`
- Modify: `services/api/tsconfig*.json`
- Modify: `services/mailer/tsconfig.json`
- Modify: `services/github-app/tsconfig*.json`
- Modify: affected workspace `package.json` files
- Modify: `bun.lock`

**Interfaces:**

- Consumes: all passing local TypeScript projects.
- Produces: `@scs/tsconfig` presets with local aliases/includes/references preserved by each consumer.

- [ ] **Step 1: Create runtime-specific presets**

Put only universal strictness/casing/skip-library behavior in `base.json`; Next.js DOM/bundler/JSX defaults in `nextjs.json`; Cloudflare Worker module and Worker types in `worker.json`; Bun/Node runtime defaults in `bun.json`. Do not move path aliases, project references, includes, output directories, Next plugins, or test types out of their owning workspace.

- [ ] **Step 2: Convert consumers one runtime group at a time**

Update the four Next.js apps, validate their type checks, then update API/GitHub App Worker projects, validate both production and test projects, then update mailer. Use `workspace:*` package references and JSON `extends` paths that TypeScript resolves from each package.

- [ ] **Step 3: Run all type and build gates**

```powershell
bun run typecheck
bun --filter '@scs/projects' typecheck:test
bun --filter '@scs/api' typecheck:test
bun --filter '@scs/github-app' typecheck:test
bun run build
```

Expected: every project passes with the same runtime libraries/types it used before extraction.

- [ ] **Step 4: Commit**

```powershell
git add packages/tsconfig apps services bun.lock
git commit -m "refactor(tsconfig): centralize runtime presets"
```

### Task 11: Centralize Repository Development Tooling

**Files:**

- Create: `.prettierignore`
- Create: `prettier.config.mjs`
- Create: `lint-staged.config.mjs`
- Create: `.husky/pre-commit`
- Create/merge: `.vscode/settings.json`
- Create/merge: `.vscode/extensions.json`
- Create/merge: `.devcontainer/devcontainer.json`
- Create/merge: `.agents/skills/**` and `skills-lock.json` only where unique tooling can be reconciled safely
- Modify: `package.json`
- Modify: workspace `package.json` files
- Remove: nested `.husky/**`, duplicate package-level Prettier/lint-staged blocks, and proven duplicate editor/devcontainer files
- Modify: `bun.lock`

**Interfaces:**

- Consumes: audited identical hook, Prettier defaults, release-age policy, and source editor/tooling files.
- Produces: one root hook and formatter while preserving workspace-specific lint behavior.

- [ ] **Step 1: Centralize formatting and staged-file dispatch**

Move the common Prettier options to `prettier.config.mjs`. Configure lint-staged so TypeScript changes trigger the owning workspace's full `lint:fix` script and supported text files receive Prettier. Add root `prepare` and `lint-staged` scripts and retain workspace `lint:fix` commands.

- [ ] **Step 2: Install the single Bun-only hook**

Create `.husky/pre-commit` that checks for Bun and runs `bun run lint-staged` from the repository root. Remove the repeated multi-package-manager hooks after confirming their only effective Bun behavior is reproduced.

- [ ] **Step 3: Merge editor, devcontainer, and agent tooling**

Create one root Bun devcontainer with forwarded ports `3000` and `8787`, Git/GitHub CLI features, and root `bun install`. Merge the union of useful VS Code recommendations/settings. Compare conflicting `.agents` skills by content; keep one identical copy, keep uniquely named skills, and document unresolved same-name conflicts instead of overwriting one silently.

- [ ] **Step 4: Validate tooling**

```powershell
bun install
bun run format:check
bun run lint
bun run typecheck
```

Stage representative temporary TypeScript and Markdown changes, run `bun run lint-staged`, then unstage and revert only those deliberate temporary changes. Expected: the owning workspace lints and Prettier receives the staged files.

- [ ] **Step 5: Commit**

```powershell
git add .husky .vscode .devcontainer .agents package.json prettier.config.mjs .prettierignore lint-staged.config.mjs apps services skills-lock.json bun.lock docs/migration
git commit -m "refactor(tooling): centralize repository tooling"
```

### Task 12: Repair Docker Builds and Consolidate CI

**Files:**

- Create: `.dockerignore`
- Modify: `apps/web/Dockerfile`
- Modify: `apps/people/Dockerfile`
- Modify: `apps/projects/Dockerfile`
- Modify: `apps/portal/Dockerfile`
- Remove: obsolete workspace `.dockerignore` files after root rules are verified
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy-web.yml`
- Create: `.github/workflows/deploy-people.yml`
- Create: `.github/workflows/deploy-projects.yml`
- Create: `.github/workflows/deploy-portal.yml`
- Modify: `docs/migration/required-secrets.md`
- Modify: `docs/migration/verification.md`

**Interfaces:**

- Consumes: final root lockfile/workspace graph, four passing Next.js builds, and original source workflows.
- Produces: independently buildable frontend images with stable GHCR identities and path-aware monorepo checks.

- [ ] **Step 1: Make each Dockerfile consume the root workspace**

Use the monorepo root as build context, install with the root `package.json`, `bun.lock`, and `bunfig.toml`, copy the workspace graph needed by Bun, and build only the selected `@scs/*` app. Copy the monorepo-shaped standalone server plus that app's static/public assets into the runtime image. Preserve each app's existing production environment defaults and non-root runtime user.

- [ ] **Step 2: Add a root Docker ignore policy**

Exclude Git metadata, all dependency/build/cache directories, ignored environment files, keys, agent-only content, logs, and unrelated local artifacts without excluding any workspace manifest or source needed by the selected build.

- [ ] **Step 3: Add path-aware checks**

Create `ci.yml` for pull requests and pushes affecting `apps/**`, `services/**`, `packages/**`, or root toolchain files. Install Bun 1.4.3 with a frozen lockfile. On pull requests run `bunx turbo run lint typecheck test build --affected` so shared-package changes reach dependants; on the default branch run the full root lint, typecheck, test, and build gates.

- [ ] **Step 4: Preserve manual image publishing identities**

Create one manual workflow per frontend, retaining the source workflow's semantic-version validation and commit-SHA fallback. Hard-code these image repositories rather than deriving them from the monorepo name: `scs.pdn.ac.lk`, `people.scs.pdn.ac.lk`, `projects.scs.pdn.ac.lk`, and `portal.scs.pdn.ac.lk`. Grant `contents: read` and `packages: write`, use each app's Dockerfile with root context, and document that `GITHUB_TOKEN` supplies GHCR authentication.

- [ ] **Step 5: Validate all images and workflow mappings**

```powershell
docker build -f apps/web/Dockerfile -t scs-web:migration-test .
docker build -f apps/people/Dockerfile -t scs-people:migration-test .
docker build -f apps/projects/Dockerfile -t scs-projects:migration-test .
docker build -f apps/portal/Dockerfile -t scs-portal:migration-test .
```

Run each image locally on a distinct port and assert a non-5xx response. Parse all four workflow files and assert their image names equal the original repositories, their Dockerfile paths are correct, and no deploy step exists for API, mailer, or GitHub App.

- [ ] **Step 6: Commit**

```powershell
git add .dockerignore .github apps/*/Dockerfile apps/*/next.config.ts docs/migration
git commit -m "ci: consolidate monorepo checks and image builds"
```

### Task 13: Document Operations and Run Final Verification

**Files:**

- Create/replace: `README.md`
- Finalize: `docs/migration/source-state.md`
- Finalize: `docs/migration/migration-matrix.md`
- Finalize: `docs/migration/required-secrets.md`
- Finalize: `docs/migration/verification.md`
- Create: `docs/migration/deferred-work.md`

**Interfaces:**

- Consumes: all migrated workspaces, shared packages, root tooling, CI, Docker, and observed verification output.
- Produces: operator/developer documentation and the evidence required to claim baseline completion.

- [ ] **Step 1: Write the root development and deployment guide**

Document the final tree, prerequisites, Bun 1.4.3 setup, PowerShell install/dev/filter commands, per-workspace scripts, lint/typecheck/test/build behavior, Docker commands, Cloudflare/Vercel/GHCR boundaries, environment templates, and the external data/config repositories. Use verified filter syntax such as `bun --filter '@scs/web' dev`.

- [ ] **Step 2: Record intentional non-extractions and deferred work**

Document whether `packages/ui`, `packages/schemas`, and `packages/utils` remain empty and why. Record that `portal` and `people` dirty working-tree changes were excluded and identify their source paths for separate later review without embedding their diffs. List missing test coverage and any external-service limitation on smoke checks.

- [ ] **Step 3: Run the final clean installation and root gates**

From a clean dependency state, run:

```powershell
bun install --frozen-lockfile
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run build
```

Expected: every supported task exits zero; Turbo reports only real workspace tasks; Projects, API, GitHub App, and any justified mailer regression test are discovered.

- [ ] **Step 4: Re-run security, source, and repository-state checks**

Assert there are no nested `.git` directories, nested lockfiles, tracked environment files other than examples, private-key markers, tracked `*.pem`, generated build/cache directories, or unclassified root configuration files. Recompare the portal and people destination product trees with their pinned archives after excluding documented monorepo-only configuration changes.

- [ ] **Step 5: Complete the verification ledger**

For each command, record date, exit status, relevant counts, and any limitation without claiming unavailable evidence. Include final tree, migrated repositories, shared packages, centralized/local configurations, Actions changes, Docker/devcontainer changes, required settings/secrets, unresolved risks, and behavior that could not be reproduced exactly.

- [ ] **Step 6: Commit documentation**

```powershell
git add README.md docs/migration
git commit -m "docs: document monorepo development and migration"
```

- [ ] **Step 7: Review the complete branch**

Run `git status --short --branch`, inspect the commit sequence and full diff from `4721d23`, and perform an independent whole-branch review focused on the five Review Focus items. The baseline is complete only when the tree is clean apart from intentionally documented files and all final gates have fresh passing evidence.
