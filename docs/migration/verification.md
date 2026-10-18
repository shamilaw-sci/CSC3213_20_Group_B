# Migration Verification Ledger

Commands are recorded after they run against the destination monorepo. A
missing suite is listed as missing coverage rather than a passing test.

## Root Bootstrap

- 2026-10-17: `bun --version` returned `1.4.3`.
- 2026-10-17: `bunx turbo --version` returned `2.11.9`.
- 2026-10-17: `git diff --check` exited successfully.

## Final baseline gate

- 2026-10-18: all root and direct-workspace dependency directories were absent
  before `bun install --frozen-lockfile`; Bun 1.4.3 installed 692 packages and
  the Husky prepare step exited successfully.
- The fresh root `format:check`, `lint`, `typecheck`, `test`, and `build` gates
  all exited successfully with zero Turbo cache hits. Turbo ran 6 lint tasks, 8
  typecheck tasks, 4 real test tasks, and 6 build tasks.
- The fresh test gate passed 4 shared ESLint tests, 8 Projects tests, 117 API
  tests, and 23 GitHub App tests. Projects retained its existing advisory about
  ESM syntax in a TypeScript Vitest configuration loaded as CommonJS.
- The auxiliary Projects, API, and GitHub App `typecheck:test` commands and the
  Mailer `check` command all exited successfully.
- A tracked-file audit found no nested lockfile, non-example environment file,
  private-key marker, PEM/key path, generated build/cache path, or nested Git
  directory. Root configuration was limited to the classified Git, Bun, Turbo,
  Prettier, lint-staged, and skill-lock files.
- Git-object comparisons matched all 157 selected Portal product files to
  `eca1474` and all 100 selected People product files to `fdd3f9e`. The audit
  exposed an ignored People environment template; commit `25953af` now tracks
  the byte-identical source file and explicitly exempts it from the workspace
  ignore rule.
- Every source repository still points to its recorded commit. Web, Projects,
  API, Mailer, and GitHub App remain clean; Portal retains 1 dirty entry and
  People retains 19 dirty entries, confirming the deferred working trees were
  not cleaned or committed.
- A history-wide scan across all 16 migration commits found no tracked PEM/key
  path, private-key marker, or occurrence of the eight sensitive literal values
  from the pinned API and GitHub App source configurations.
- The Mailer started through its root package filter with an inert local API
  key. `GET /favicon.ico` returned HTTP 200 and the exact 285,478-byte asset;
  `GET /` returned the expected HTTP 404, reconfirming its root-relative path.
- Whole-branch review confirmed the separate package names and runtime scripts,
  preserved API/GitHub App routes and public bindings, verification-only CI,
  and a clean destination working tree after documentation was committed.

## Shared repository tooling

- 2026-10-18: `bun install`, `bun run format:check`, `bun run lint`, and
  `bun run typecheck` exited successfully after root tooling consolidation.
- 2026-10-18: a temporary staged Web TypeScript file invoked the owning
  workspace's full `lint:fix` script, while that file and a staged Markdown
  probe were both formatted successfully. The probe files were then removed.

## Continuous integration and local skills

- 2026-10-18: Prettier parsed the path-aware root CI workflow successfully;
  static assertions confirmed Bun 1.4.3, frozen installation, affected pull
  request tasks, and full default-branch gates are present.
- Dockerfiles, Compose files, Docker ignore rules, container development
  configuration, and GHCR workflows were removed by explicit user direction.
  No Docker build or runtime result is claimed.
- `.agents` payloads are ignored and untracked. After removing stale upstream
  entries and consolidating the valid records, a root-scoped
  `bunx skills experimental_install` restored all twelve skills with exit code 0. Nested Portal installation was abandoned because
  the installer removed unrelated tracked workspace files; those files were
  restored byte-for-byte from the current monorepo commit.
- 2026-10-18: after removing the container-only Next.js adaptations,
  `bun run format:check`, `lint`, `typecheck`, `test`, and `build` all exited
  successfully. Turbo ran 6 lint tasks, 8 typechecks, 4 real test tasks, and 6
  builds; the test suites passed 4 ESLint-config tests, 8 Projects tests, 117
  API tests, and 23 GitHub App tests.

## `@scs/web`

- Source: `scs.pdn.ac.lk@7de460eda9813266bdfbde1a803d95032b164c95`.
- Existing partial import: 53 files matched the committed tree; the only extra
  file was generated `next-env.d.ts`, which was removed before import.
- Tests: no test files or source test script exist.
- 2026-10-17: `bun install` installed 401 packages and generated the root
  lockfile successfully.
- 2026-10-17: `bun --filter '@scs/web' lint` exited successfully.
- 2026-10-17: `bun --filter '@scs/web' typecheck` exited with code 0.
- 2026-10-17: `bun --filter '@scs/web' build` completed with all 27 static or
  dynamic routes generated and exit code 0.
- 2026-10-17: the development server became ready on port 3100; `GET /`
  returned HTTP 200 with a 26,531-byte response.

## `@scs/people`

- Source: `people.scs.pdn.ac.lk@fdd3f9edfac553033c89d08eb0419f850ca5aff6`.
- Import policy: committed Git archive only; the dirty working-tree route and
  component changes listed in `source-state.md` were excluded.
- Tests: no test files or source test script exist.
- 2026-10-17: all 17 tracked dirty-source paths matched their objects at
  `fdd3f9e`; the two new dirty-source paths were absent from the destination.
- Initial build observation: Next.js attempted to install missing
  `@types/node` with pnpm. The generated pnpm lockfile was removed and
  `@types/node` was declared as `^25.6.0`, matching the already validated web
  app's compatible range. A clean Bun install then reported no changes.
- 2026-10-17: `bun --filter '@scs/people' lint`, `typecheck`, and `build`
  exited with code 0 without invoking another package manager. The build
  generated 13 static/dynamic route entries.
- 2026-10-17: the development server became ready on port 3101; `GET /`
  returned HTTP 200 with 49,487 bytes and
  `GET /students/computer-science/s21` returned HTTP 200 with 78,508 bytes.

## `@scs/projects`

- Source: `projects.scs.pdn.ac.lk@3e905bd8873fceb95f3cc2ac8a4c43f1f34ea840`.
- Import policy: committed Git archive only; repository-level lockfiles, hooks,
  editor settings, and CI metadata remain owned by the monorepo.
- The first lint gate exposed four `react-hooks/set-state-in-effect` errors in
  the committed search and username lookup views. The repair preserves their
  URL-driven form reset behavior with keyed uncontrolled inputs and avoids
  synchronously clearing state that is already hidden when no query exists.
- 2026-10-17: `bun --filter '@scs/projects' lint`, `typecheck`, and
  `typecheck:test` exited successfully.
- 2026-10-17: `bun --filter '@scs/projects' test` discovered all three test
  files and passed all eight tests. Vitest emitted its existing advisory that
  the TypeScript config uses ESM syntax without a package-level module type;
  this did not affect the test result.
- 2026-10-17: `bun --filter '@scs/projects' build` completed with all 13
  static/dynamic route entries generated and exit code 0.

## `@scs/portal`

- Source: `portal.scs.pdn.ac.lk@eca1474b7c28535a223bd96a631b83481c91df9f`.
- Import policy: committed Git archive only; the dirty source working tree was
  neither read as migration input nor modified.
- 2026-10-17: the migrated
  `src/components/custom/project-management-page/ProjectManagementPage.tsx`
  matched the object from `eca1474` byte-for-byte, proving the known dirty edit
  was excluded.
- Tests: no test files or source test script exist.
- 2026-10-17: `bun --filter '@scs/portal' lint`, `typecheck`, and `build`
  exited successfully. The production build generated all 35 listed static or
  dynamic route entries.
- 2026-10-17: the development server became ready on port 3102; `GET /`
  returned HTTP 200 with an 88,877-byte response. No authenticated mutation or
  external write was attempted.

## `@scs/api`

- Source: `api.scs.pdn.ac.lk@0f5c03e3f57e5f44059d7b41f8b63cf5022f2d36`.
- The committed Wrangler file was treated as tainted input. The destination
  configuration retains the Worker name, entrypoint, compatibility date,
  custom domain, public OAuth identifiers and redirects, service URLs, three
  KV bindings, and observability settings while omitting all six plaintext
  secret values.
- 2026-10-17: the pre-stage regression scan found no source secret literal,
  private-key marker, committed `.dev.vars`, or non-template environment file
  under `services/api`.
- 2026-10-17: `bun --filter '@scs/api' typecheck`, `typecheck:test`, and
  `lint` exited successfully.
- 2026-10-17: `bun --filter '@scs/api' test` discovered all nine preserved
  files and passed all 117 tests with 384 assertions.
- 2026-10-17: `bun --filter '@scs/api' build` completed a Wrangler dry-run
  bundle successfully and reported only the intended public variables and KV
  bindings.

## `@scs/mailer`

- Source: `mailer.scs.pdn.ac.lk@7043928c8cf1510a081739201dc69f1d19949bc7`.
- Tests: no test files or source test script exist.
- 2026-10-17: `bun --filter '@scs/mailer' typecheck` and `check` exited
  successfully; `check` reran TypeScript and confirmed the workspace matches
  its preserved Prettier rules.
- 2026-10-17: the service started from the repository root through
  `bun --filter '@scs/mailer' start` with inert local placeholders on port 3103. `GET /favicon.ico` returned HTTP 200 with the committed 285,478-byte
  asset, proving filtered scripts execute with the workspace-relative static
  path intact. Non-mutating `GET /` returned the expected JSON 404 response.

## `@scs/github-app`

- Source: `scs-portal-github-app@5a3b82472af63a664a5011bde52f4135ffb8aa45`.
- Import policy: `keys/**`, every `*.pem`, local hooks, nested lockfiles, and
  local environment files were denylisted. The destination contains a
  placeholder-only template and a reconstructed Wrangler configuration with
  public identifiers only.
- 2026-10-17: the pre-stage credential scan found no private-key marker,
  tracked PEM/key-directory path, source internal-secret literal, or forbidden
  local environment file in the destination or existing Git index.
- The committed package omitted a `test` script despite containing three test
  files. The workspace adds `test: bun test` so the migration gate executes
  rather than silently skipping those suites.
- 2026-10-17: `bun --filter '@scs/github-app' typecheck`, `typecheck:test`,
  and `lint` exited successfully.
- 2026-10-17: `bun --filter '@scs/github-app' test` discovered all three
  preserved files and passed all 23 tests with 28 assertions.
- 2026-10-17: `bun --filter '@scs/github-app' build` completed a Wrangler
  dry-run bundle successfully and reported only the intended non-secret
  identifiers, repository names, and port.
