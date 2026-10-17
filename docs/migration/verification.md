# Migration Verification Ledger

Commands are recorded after they run against the destination monorepo. A
missing suite is listed as missing coverage rather than a passing test.

## Root Bootstrap

- 2026-10-17: `bun --version` returned `1.4.3`.
- 2026-10-17: `bunx turbo --version` returned `2.11.9`.
- 2026-10-17: `git diff --check` exited successfully.

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
  `bun --filter '@scs/mailer' start` with inert local placeholders on port
  3103. `GET /favicon.ico` returned HTTP 200 with the committed 285,478-byte
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
