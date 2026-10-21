# Repository Optimization Implementation Plan

**Design:** `docs/REPOSITORY_OPTIMIZATION_DESIGN.md`

**Objective:** Evolve the monorepo and its Git-backed publication workflows
into a maintainable, pagination-first, concurrency-safe architecture without a
flag-day rewrite or loss of existing behavior.

**Execution rule:** Complete the slices in order. Every slice ends with focused
verification and a Conventional Commit. Diagnose failures; do not skip gates.
Do not start the next major slice while the current slice is unverified.

**Runtime constraint:** Do not add or build Docker artifacts.

## Global Guardrails

- Keep `portal.scs.pdn.ac.lk` and `people.scs.pdn.ac.lk` source repositories
  untouched.
- Limit sibling-repository changes to approved workflow, generator,
  validation, and publication work in `data.scs.pdn.ac.lk` and
  `config.scs.pdn.ac.lk`.
- Preserve current public routes during the compatibility period.
- Prefer additive schema and endpoint changes before removing old behavior.
- Treat individual entity files as authoritative and shared indexes as derived.
- Never force-update a Git ref after a compare-and-set failure.
- Never retry validation, authorization, or stale-revision failures.
- Do not hold a coordination lock across an external GitHub request.
- Keep services and applications independently buildable and deployable.
- Keep tracked Markdown in root `README.md` or root `docs/`, with uppercase
  snake-case filenames.
- Run `git status --short` before and after each slice. Preserve unrelated user
  changes and stop if they overlap a planned edit.

## Slice 1: Remove Local Residue and Consolidate Documentation

### Files

Create or rewrite:

- `.gitignore`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/API_CONTRACTS.md`
- `docs/DEVELOPMENT.md`
- `docs/OPERATIONS.md`
- `docs/SCHEMAS.md`
- `docs/SECURITY.md`
- `scripts/check-documentation.mts`
- `package.json`

Remove after extracting durable content:

- `.superpowers/` from the local checkout
- `docs/superpowers/`
- `docs/migration/`
- `apps/*/README.md`
- `apps/people/ROUTES.md`
- `apps/portal/docs/`
- `services/*/README.md`
- `services/*/docs/`
- `packages/schemas/README.md`
- `packages/schemas/docs/`

### Steps

1. Inventory each document heading and copy only current architecture,
   operation, configuration, security, schema, route, and deployment facts into
   the new root documents.
2. Delete historical migration evidence, copied source-repository prose, stale
   reports, and redundant workspace introductions.
3. Add `.superpowers/`, `.agents/`, and other confirmed local assistant/cache
   paths to `.gitignore`. Keep `skills-lock.json` tracked.
4. Add `scripts/check-documentation.mts` to fail when tracked Markdown is
   outside the permitted roots, has a nonconforming filename, or links to a
   removed local Markdown path.
5. Add root `docs:check` and include it in CI-relevant verification.
6. Remove the local `.superpowers` directory only after resolving its absolute
   path inside this checkout and confirming it is untracked.

### Verification

```powershell
bun run docs:check
bunx prettier --check README.md docs scripts/check-documentation.mts
git diff --check
git status --short
```

Expected documentation inventory:

```powershell
rg --files -g '*.md'
```

Only `README.md` and uppercase-snake-case files under root `docs/` may remain.

### Commit

```text
docs: consolidate repository documentation
```

## Slice 2: Make CI Fast, Complete, and Predictable

### Files

Modify:

- `.github/workflows/ci.yml`
- `package.json`
- `turbo.json`
- workspace `package.json` files only where a missing verification script must
  be made explicit

Create:

- `docs/CI.md`

### Steps

1. Add pull-request concurrency keyed by workflow and ref with
   `cancel-in-progress: true`; keep main pushes non-cancelling.
2. Include root source/configuration, documentation checker, and workflow paths
   that can affect required checks.
3. Add distinct fast gates for documentation/format and affected Turbo tasks so
   a simple failure is reported early.
4. Keep the full `lint`, `typecheck`, `test`, and `build` gate on `main`.
5. Add Commitlint validation for pull-request commits or the pull-request title
   without requiring unnecessary full builds.
6. Add dependency caching only through supported Bun/setup behavior; do not
   cache build output in a way that can hide stale verification.
7. Ensure a workspace without tests is reported as missing coverage rather than
   described as passing tests.
8. Document check names, triggers, affected behavior, cancellation, and local
   equivalents in `docs/CI.md`.

### Verification

```powershell
bun run docs:check
bun run format:check
bunx turbo run lint typecheck test build --dry=json
git diff --check
```

Manually inspect the workflow event matrix for `pull_request`, `push`, and
documentation-only changes. Do not claim remote Actions success until a real
run is observed.

### Commit

```text
ci: streamline verified workspace checks
```

## Slice 3: Add Contract and Performance Characterization

### Files

Create or extend:

- `services/api/test/characterization/github-app-proxy.test.ts`
- `services/api/test/characterization/paginated-lists.test.ts`
- `services/github-app/tests/github-call-characterization.test.ts`
- `services/github-app/tests/concurrent-mutations.test.ts`
- `apps/portal/src/lib/project-data.test.ts`
- `apps/portal/src/lib/user-list.test.ts`
- `apps/portal/package.json`
- `docs/PERFORMANCE_BASELINE.md`

### Steps

1. Add a Portal test script using the existing Bun runner for pure TypeScript
   loaders and transformations; avoid introducing a browser framework in this
   slice.
2. Characterize existing API success/error envelopes and redirects used by the
   Portal.
3. Record mocked GitHub call counts for profile, project, course, offering, and
   config mutations.
4. Add failing concurrency cases for duplicate delivery, same-entity stale
   writes, and unrelated entities that currently share aggregate files.
5. Add failing list cases proving that the current project editor loads all
   three registries and that admin user listing is unbounded.
6. Document measured request counts, payload sizes from fixtures, component
   sizes, and the exact commands used. Do not invent production latency data.

### Verification

```powershell
bun --filter '@scs/api' test
bun --filter '@scs/github-app' test
bun --filter '@scs/portal' test
bun --filter '@scs/portal' typecheck
```

Some newly added tests are expected to demonstrate the bottleneck before later
slices. Mark those as explicit characterization assertions, not skipped tests.

### Commit

```text
test: characterize api concurrency and portal loading
```

## Slice 4: Publish Shared API Contracts

### Files

Create:

- `packages/schemas/src/schemas/api/error.schema.ts`
- `packages/schemas/src/schemas/api/operation.schema.ts`
- `packages/schemas/src/schemas/api/pagination.schema.ts`
- `packages/schemas/src/schemas/api/mutation.schema.ts`
- `packages/schemas/tests/api/error.test.ts`
- `packages/schemas/tests/api/operation.test.ts`
- `packages/schemas/tests/api/pagination.test.ts`

Modify:

- `packages/schemas/src/index.ts`
- `packages/schemas/tests/contract/public-api.test.ts`
- `docs/API_CONTRACTS.md`
- affected API, GitHub App, and Portal type imports

### Steps

1. Define the versioned error envelope with stable machine code, bounded
   message, correlation ID, and optional conflict details.
2. Define operation IDs, statuses, resource identities, actor-safe status
   responses, and terminal outcomes.
3. Define opaque cursor request and page response schemas with bounded page
   size.
4. Define idempotency and expected entity revision fields for mutations.
5. Export inferred types through `@scs/schemas` and replace duplicated local
   transport types without moving adapter-only configuration into the package.
6. Add compile-time/public-export tests so accidental removal is caught.

### Verification

```powershell
bun --filter '@scs/schemas' lint
bun --filter '@scs/schemas' typecheck
bun --filter '@scs/schemas' test
bun --filter '@scs/schemas' build
bun --filter '@scs/api' typecheck
bun --filter '@scs/github-app' typecheck
bun --filter '@scs/portal' typecheck
```

### Commit

```text
feat(schemas): add operation and pagination contracts
```

## Slice 5: Normalize Runtime Configuration and Internal Calls

### Files

Create:

- `services/github-app/src/types/env.ts`
- `services/github-app/src/config/runtime.config.ts`
- `services/github-app/src/app.ts`
- `services/github-app/tests/runtime-config.test.ts`
- `services/api/src/clients/github-app.client.ts`
- `services/api/test/unit/github-app.client.test.ts`

Modify:

- `services/github-app/src/index.ts`
- `services/github-app/src/server.ts`
- `services/github-app/src/config/client.config.ts`
- `services/github-app/src/middleware/auth.ts`
- `services/github-app/wrangler.jsonc`
- `services/api/src/types/env.ts`
- `services/api/src/services/proxy.service.ts`
- `services/api/src/services/public-profile.service.ts`
- `services/api/src/services/public-project.service.ts`
- `services/api/src/services/public-course.service.ts`
- `services/api/wrangler.jsonc`

### Steps

1. Replace the module-load `process.env` snapshot in Worker code with typed
   request bindings. Keep `server.ts` as the Bun adapter that constructs the
   same environment contract from `process.env`.
2. Validate required runtime values once at adapter entry and return a clear
   startup/request configuration failure without logging secret values.
3. Use constant-time internal-secret comparison for the HTTP adapter.
4. Consolidate API-to-GitHub-App calls into one client with timeout,
   correlation ID, response parsing, and typed error mapping.
5. Add an optional Cloudflare service binding while retaining the HTTP base URL
   fallback for independent deployment and local execution.
6. Delete duplicated `githubAppUrl` and `callGithubApp` helpers after all
   consumers use the client.

### Verification

```powershell
bun --filter '@scs/api' test
bun --filter '@scs/api' lint
bun --filter '@scs/api' typecheck
bun --filter '@scs/api' build
bun --filter '@scs/github-app' test
bun --filter '@scs/github-app' lint
bun --filter '@scs/github-app' typecheck
bun --filter '@scs/github-app' build
```

### Commit

```text
refactor(api): centralize runtime and github app clients
```

## Slice 6: Build the GitHub Repository Gateway

### Files

Create:

- `services/github-app/src/github/github.types.ts`
- `services/github-app/src/github/github.errors.ts`
- `services/github-app/src/github/github.client.ts`
- `services/github-app/src/github/repository.gateway.ts`
- `services/github-app/src/github/atomic-commit.ts`
- `services/github-app/src/github/pull-request.gateway.ts`
- `services/github-app/tests/github-errors.test.ts`
- `services/github-app/tests/atomic-commit.test.ts`
- `services/github-app/tests/repository-gateway.test.ts`

Modify incrementally:

- `services/github-app/src/config/client.config.ts`
- `services/github-app/src/integrations/github-pull-request.ts`
- repository modules under `services/github-app/src/repositories/`

### Steps

1. Introduce injectable GitHub client and repository configuration interfaces.
2. Centralize provider error classification, including not-found, missing-ref,
   compare conflict, validation, primary rate limit, secondary rate limit, and
   transient server errors.
3. Reuse an installation client safely while keeping request/actor state out of
   module globals.
4. Implement read helpers that can resolve files from one tree snapshot rather
   than issuing one Contents request per file.
5. Implement an atomic commit builder using blobs, a tree based on the expected
   parent tree, one commit, and compare-and-set ref update.
6. Treat a changed ref as a conflict and return its current SHA; never use a
   force update.
7. Centralize PR search with pagination and structured operation metadata.
8. Implement rate-limit-aware retry classification. The executor, not domain
   logic, controls retry timing.
9. Migrate the generic config-file PR integration first as a contained proof.

### Verification

```powershell
bun --filter '@scs/github-app' test
bun --filter '@scs/github-app' lint
bun --filter '@scs/github-app' typecheck
bun --filter '@scs/github-app' build
```

The atomic-commit test must prove multiple file changes result in one commit
and that a changed expected ref cannot be overwritten.

### Commit

```text
refactor(github-app): add atomic repository gateway
```

## Slice 7: Add Durable Idempotent Operations

### Files

Create:

- `services/github-app/src/operations/operation.types.ts`
- `services/github-app/src/operations/operation.store.ts`
- `services/github-app/src/operations/operation.executor.ts`
- `services/github-app/src/operations/in-memory-operation.store.ts`
- `services/github-app/src/operations/cloudflare-operation.store.ts`
- `services/github-app/src/operations/mutation-coordinator.ts`
- `services/github-app/src/operations/queue.consumer.ts`
- `services/github-app/src/controllers/operation.controller.ts`
- `services/github-app/tests/operation-idempotency.test.ts`
- `services/github-app/tests/operation-concurrency.test.ts`
- `services/github-app/tests/operation-recovery.test.ts`

Modify:

- `services/github-app/src/app.ts`
- `services/github-app/src/index.ts`
- `services/github-app/src/server.ts`
- `services/github-app/src/types/env.ts`
- `services/github-app/wrangler.jsonc`
- `services/github-app/package.json`
- `docs/OPERATIONS.md`

### Steps

1. Define an application-level executor and store interface independent of
   Cloudflare types.
2. Implement deterministic idempotency hashing over actor, action, resource,
   and validated payload.
3. Implement local in-memory execution for Bun development and unit tests.
4. Add production queue bindings, a dead-letter queue, and a durable operation
   state/coordinator binding with an explicit Wrangler migration.
5. Keep coordinator transactions short. Store state transitions before and
   after external calls rather than blocking all concurrency during GitHub I/O.
6. Serialize the same resource while allowing distinct resource keys to
   progress independently.
7. Add status and cancellation endpoints with actor/admin authorization.
8. Add bounded retry and provider-aware delay behavior; persist attempt and
   last-error categories.
9. Add structured correlation logging without request bodies or secrets.

### Verification

```powershell
bun --filter '@scs/github-app' test
bun --filter '@scs/github-app' lint
bun --filter '@scs/github-app' typecheck
bun --filter '@scs/github-app' build
```

Run the concurrency test repeatedly to detect nondeterminism:

```powershell
1..10 | ForEach-Object { bun --filter '@scs/github-app' test -- operation-concurrency }
```

### Commit

```text
feat(github-app): add durable idempotent mutations
```

## Slice 8: Migrate Profile Mutations and Projections

### Files

Create:

- `services/github-app/src/domains/profiles/profile.types.ts`
- `services/github-app/src/domains/profiles/profile.projection.ts`
- `services/github-app/src/domains/profiles/profile.operation.ts`
- `services/github-app/src/domains/profiles/profile.repository.ts`
- `services/github-app/tests/profile-operation.test.ts`
- `services/github-app/tests/profile-projection.test.ts`

Modify:

- `services/github-app/src/repositories/public-profile.repo.ts`
- `services/github-app/src/controllers/public-profile.controller.ts`
- `services/github-app/src/schemas/request.schema.ts`
- `services/api/src/services/public-profile.service.ts`
- Portal profile mutation consumers

### Steps

1. Extract pure identity, membership, projection, and search-entry functions.
2. Change the mutation use case to write only the authoritative user record and
   structured operation metadata.
3. Use the expected user blob SHA as the public revision.
4. Route new requests through the operation API while keeping existing status
   and mutation responses available through a compatibility adapter.
5. Remove whole-directory user reads from the request path.
6. Add explicit same-profile conflict details and duplicate-submission
   behavior.
7. Keep old aggregate update helpers only until the external generator slice is
   ready; mark them internal compatibility code and cover them with tests.

### Verification

```powershell
bun --filter '@scs/github-app' test
bun --filter '@scs/api' test
bun --filter '@scs/portal' test
bun --filter '@scs/github-app' typecheck
bun --filter '@scs/api' typecheck
bun --filter '@scs/portal' typecheck
```

### Commit

```text
refactor(profiles): use entity-versioned operations
```

## Slice 9: Migrate Project and Academic Mutations

Before Slice 9, complete the approved authentication interlude: introduce
Better Auth on the API Worker with D1-backed state, migrate the Portal client,
provide a reviewed legacy-identity/passkey migration path, and remove the
legacy auth routes after compatibility validation. Keep this work in separate
verification-gated commits so it does not weaken the registry slices.

Interlude status on 2026-10-20:

- Better Auth with D1 is the sole runtime authentication implementation for
  Google, GitHub, email OTP, passkeys, sessions, account linking, and sign-out;
- legacy JWT, custom OAuth, magic-code KV, token blacklist, and custom WebAuthn
  routes and bindings are removed;
- a confirmation-gated super-admin action performs the one-time GitHub
  identity and passkey migration, cleans migrated permission records, and
  reports conflicts without deleting their source fields;
- remove the migration action after the production migration is reviewed.

### Files

Create:

- `services/github-app/src/domains/projects/project.projection.ts`
- `services/github-app/src/domains/projects/project.operation.ts`
- `services/github-app/src/domains/projects/project.repository.ts`
- `services/github-app/src/domains/academics/academic.projection.ts`
- `services/github-app/src/domains/academics/academic.operation.ts`
- `services/github-app/src/domains/academics/academic.repository.ts`
- focused tests under `services/github-app/tests/`

Modify:

- `services/github-app/src/repositories/public-project.repo.ts`
- `services/github-app/src/repositories/public-course.repo.ts`
- corresponding controllers and request schemas
- `services/api/src/services/public-project.service.ts`
- `services/api/src/services/public-course.service.ts`
- Portal project and course mutation consumers

### Steps

1. Extract project/person membership and academic record transformations into
   pure modules.
2. Convert project, course, and offering mutations to authoritative record
   commits with entity blob revisions.
3. Stop treating aggregate and manifest revisions as user-edit conflicts.
4. Route mutation submission and status through shared operations.
5. Add same-entity conflict tests and prove different projects/courses can be
   prepared concurrently.
6. Delete duplicated file/branch/PR helpers from the old repositories as each
   path moves behind the gateway.
7. Keep student placement and config mutations on the gateway, with resource
   keys that serialize their genuinely shared files.

### Status on 2026-10-20

- complete: project, course, and offering operation definitions, entity-scoped
  coordination keys, authoritative-record revisions, and conflict tests;
- complete: public API async submission and Portal bounded status polling for
  project, course, offering, and profile mutations;
- complete: pure project aggregate, manifest, membership, and academic
  aggregate transformations with direct unit coverage;
- retained intentionally: synchronous compatibility routes and their existing
  file/branch/PR helpers;
- deferred to the coordinated projection slice: deterministic aggregate and
  manifest generation, followed by compatibility-helper removal;
- transition gate satisfied: Slice 10 can proceed while compatibility cleanup
  remains gated on the coordinated projection rollout.

### Verification

```powershell
bun --filter '@scs/github-app' test
bun --filter '@scs/github-app' lint
bun --filter '@scs/github-app' typecheck
bun --filter '@scs/github-app' build
bun --filter '@scs/api' test
bun --filter '@scs/api' typecheck
bun --filter '@scs/portal' test
bun --filter '@scs/portal' typecheck
```

### Commit

```text
refactor(registries): isolate concurrent entity mutations
```

## Slice 10: Add Bounded Pagination and Remove KV N+1 Listing

### Files

Create:

- `services/api/src/pagination/cursor.ts`
- `services/api/test/unit/cursor.test.ts`
- `services/api/test/characterization/admin-user-pages.test.ts`
- pagination helpers/tests in the data repository during the coordinated
  projection slice

Modify:

- `services/api/src/repositories/permissions.repo.ts`
- `services/api/src/services/admin.service.ts`
- `services/api/src/services/proxy.service.ts`
- `services/api/src/services/public-project.service.ts`
- `services/api/src/services/public-course.service.ts`
- `services/api/src/routes/index.ts`
- `services/api/src/config/client.config.ts`
- all permission write paths that must maintain KV metadata
- `docs/API_CONTRACTS.md`

### Steps

1. Add opaque, versioned cursors with strict decoding and bounded page sizes.
2. Return KV list metadata for user-table summaries instead of loading every
   permission value.
3. Add a safe metadata backfill path and tolerate old entries during rollout.
4. Change admin users and proxies to bounded cursor pages.
5. Add project, course, and offering page envelopes, initially behind additive
   versioned endpoints.
6. Preserve legacy full-list endpoints for compatibility, but stop using them
   from Portal after the next slice.
7. Add stable ordering and cursor invalidation/version behavior to the contract
   tests.

### Status on 2026-10-20

- complete: scoped versioned cursor encoding, strict decoding, defaults, and
  the shared maximum page size;
- complete: additive admin-user page envelopes backed by KV metadata, with
  safe read-and-backfill behavior for legacy entries;
- verified: metadata-backed pages perform no per-row permission reads and the
  legacy full-array contract remains compatible;
- complete: additive project, course, and offering page envelopes with stable
  key ordering, scoped cursors, deletion-tolerant continuation, bounded limits,
  and cross-resource cursor rejection;
- complete: D1-owned proxy settings, atomic concurrent attempt consumption,
  stable email-ordered cursor pages, and admin-only attempt resets;
- complete: Portal proxy reads and edits use the API directly, while the GitHub
  App no longer exposes proxy configuration routes or creates proxy PRs;
- complete: an idempotent, conflict-reporting admin action imports the legacy
  signed proxy aggregate before its migration-only credentials are retired;
- verified: proxy pages perform bounded D1 queries without upstream fetches,
  and concurrent edits cannot consume more than the allowed attempt count.

### Verification

```powershell
bun --filter '@scs/api' test
bun --filter '@scs/api' lint
bun --filter '@scs/api' typecheck
bun --filter '@scs/api' build
```

Tests must prove one user page does not call `PERMISSIONS.get` for each listed
user and cannot exceed the maximum page size.

### Commit

```text
feat(api): add cursor-paginated registry endpoints
```

## Slice 11: Make Portal Server-First and Page-Oriented

### Files

Create:

- `apps/portal/src/lib/server/api-client.ts`
- `apps/portal/src/lib/pagination.ts`
- `apps/portal/src/components/custom/pagination/Pagination.tsx`
- focused project/course/user list modules and tests

Modify:

- `apps/portal/src/app/user/projects/page.tsx`
- `apps/portal/src/app/admin/projects/page.tsx`
- `apps/portal/src/app/academic/courses/page.tsx`
- `apps/portal/src/app/admin/users/page.tsx`
- `apps/portal/src/app/admin/proxies/page.tsx`
- dynamic detail pages for projects, courses, users, and profiles
- `apps/portal/src/components/custom/project-management-page/ProjectManagementPage.tsx`
- `apps/portal/src/components/custom/course-management-page/CourseManagementPage.tsx`
- `apps/portal/src/components/custom/public-profile-page/PublicProfilePage.tsx`
- `apps/portal/src/components/custom/manage-users-page/ManageUsersPage.tsx`
- `apps/portal/src/lib/api.ts`
- `apps/portal/package.json`

### Steps

1. Read `searchParams` in Server Component pages and request only the selected
   cursor page.
2. Render the initial list and shell on the server, then pass bounded data to a
   focused interactive client island.
3. Use link-based previous/next controls that preserve filter and search query
   parameters and expose accessible labels.
4. Load one entity on detail routes rather than loading the complete registry.
5. Remove courses and offerings from the project list request. Fetch them only
   when the selected editor needs course-project reference choices.
6. Move authentication and initial request waterfalls out of mount effects
   where server execution is possible.
7. Split project, course, and profile editors by domain responsibility and
   lazy-load JSON/CodeMirror views.
8. Keep unsaved editor state and mutation feedback in client components.
9. Poll operation status with bounded backoff, stop at terminal state, and show
   actionable conflict recovery rather than generic failure.
10. Add focused pure-function/component tests and verify real list/detail routes
    at mobile and desktop widths through the Next development loop.

### Status on 2026-10-21

- complete: project, course, user, proxy, and profile routes render their
  initial bounded data on the server;
- complete: cursor navigation preserves query state and exposes accessible
  previous and next links;
- complete: project lists request only the project page endpoint, while the
  selected project editor loads its course and offering references;
- complete: selected project, course, user, and profile routes load one entity
  instead of their complete registries;
- complete: JSON and CodeMirror views load on demand, while mutation polling
  uses bounded backoff and stops on terminal outcomes or component unmount;
- verified with a local API fixture: navigating to the next project page changed
  the URL and issued one bounded page request; the project detail issued no
  project-list request;
- verified through the Next development MCP and browser runtime: there were no
  compilation or session errors, and the list/detail layouts had no horizontal
  overflow at 360, 768, or 1440 CSS pixels.

### Verification

```powershell
bun --filter '@scs/portal' test
bun --filter '@scs/portal' lint
bun --filter '@scs/portal' typecheck
bun --filter '@scs/portal' build
```

Runtime checks must verify:

- list navigation changes the URL and fetches one bounded page;
- a project list does not request courses or offerings;
- a project detail does not request the complete project registry;
- operation polling stops on success, conflict, failure, and unmount;
- layouts remain usable at 360, 768, and 1440 CSS pixels.

### Commit

```text
perf(portal): render paginated data server first
```

## Slice 12: Generate Projections and Correct External Workflows

This slice operates in separate repositories and must produce separate commits.

### Data Repository Files

Create or modify under
`C:/Users/sivot/Documents/CSC3213/data.scs.pdn.ac.lk`:

- `.github/scripts/generate-public-projections.ts`
- `.github/scripts/validate-people-data.ts`
- `.github/scripts/validate-projects-data.ts`
- `.github/scripts/validate-academic-data.ts`
- `tests/generate-public-projections.test.ts`
- projection validation tests
- `.github/workflows/validate-public-data.yml`
- `.github/workflows/auto-merge-profile-pr.yml` or its renamed replacement
- `.github/workflows/deploy.yml`
- `package.json`
- generated public projection files

### Config Repository Files

Modify under
`C:/Users/sivot/Documents/CSC3213/config.scs.pdn.ac.lk` as required:

- `.github/workflows/validate-config-data.yml`
- `.github/workflows/auto-merge-config-pr.yml`
- `scripts/validate-config.ts`
- `test/config-schema.test.ts`

### Steps

1. Confirm both sibling repositories are clean or isolate intentional existing
   changes before editing. Do not overwrite unrelated work.
2. Build deterministic people, project, academic, search, manifest,
   `by-person`, and paginated projections from authoritative entity files.
3. Sort every generated collection explicitly and make generation idempotent.
4. Test that two runs produce no diff and that removing an entity removes all
   of its derived memberships.
5. Make PR validation check-only. Remove `format` before `format:check`.
6. Add `merge_group` validation for repositories configured with a merge
   queue, and document the required ruleset/operator setup.
7. Serialize publication of derived files and prove a deployed commit contains
   both the authoritative change and matching projections.
8. Trigger deployment after the verified main publication state; retain manual
   dispatch and a recovery path. Remove the periodic schedule only after the
   event-driven path is observed working.
9. Restrict workflow permissions and keep write credentials unavailable to
   untrusted PR code.
10. Ensure the GitHub App token used for queue/merge automation has only the
    required repository permissions.

### Data Repository Verification

```powershell
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run validate:people
bun run validate:academic
bun run validate:projects
bun run format:check
bunx wrangler build
git diff --check
```

### Config Repository Verification

```powershell
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run validate:config
bun run format:check
bun run build
git diff --check
```

### Commits

Data repository:

```text
feat(data): generate concurrency-safe public projections
```

Configuration repository, only if changed:

```text
ci: serialize validated configuration updates
```

Do not report merge queue or ruleset completion until the remote repository
settings and a real merge-group run are verified.

### Status on 2026-10-21

- data repository commit `12966fb` adds deterministic projection generation,
  check-only validation, idempotence and deletion-cascade tests, merge-group
  validation, serialized recovery publication, and deployment from the exact
  successfully validated main commit;
- config repository commit `450a4f0` makes validation check-only, adds
  merge-group validation, restricts validation permissions, and documents the
  same-repository auto-merge boundary;
- local data verification passed typecheck, 20 tests, projection freshness,
  all three domain validators, formatting, Wrangler build, and diff checks;
- local config verification passed typecheck, 4 tests, config validation,
  formatting, Wrangler build, and diff checks;
- remote ruleset requirements, merge-queue execution, auto-merge, recovery PR
  publication remain unverified operator tasks;
- GitHub Actions run `39565486965` successfully validated and deployed exact
  data commit `12966fb` through the event-driven `workflow_run` path;
- data commits `b6f3375` and `e085f76` remove the observed polling fallback and
  make deployment-workflow changes trigger the public-data validation gate;
- manual dispatch remains the explicit deployment recovery path.

## Slice 13: Remove Compatibility Debt and Run Final Gates

### Files

Modify or remove based on confirmed use:

- legacy synchronous mutation adapters
- legacy full-list Portal API helpers
- old repository helper modules replaced by the gateway
- stale local request schemas replaced by `@scs/schemas`
- unused dependencies and Knip suppressions
- `docs/ARCHITECTURE.md`
- `docs/API_CONTRACTS.md`
- `docs/OPERATIONS.md`
- `docs/PERFORMANCE_BASELINE.md`
- `README.md`

### Steps

1. Search every legacy endpoint/helper before deletion and document remaining
   external consumers.
2. Remove compatibility code only when Portal and known clients no longer use
   it, or retain a documented deprecation window.
3. Run Knip and dependency checks workspace by workspace. Review each result;
   do not bulk-delete dynamic entry points.
4. Compare final request counts and payload sizes with the recorded baseline.
5. Exercise duplicate, same-entity concurrent, unrelated concurrent, stale,
   retry, and recovery scenarios end to end with provider calls mocked or a
   dedicated test repository.
6. Verify all documentation links and uppercase Markdown naming.
7. Record external settings that were verified and clearly list any operator
   action that remains.

### Workspace Gates

```powershell
bun --filter '@scs/schemas' lint
bun --filter '@scs/schemas' typecheck
bun --filter '@scs/schemas' test
bun --filter '@scs/schemas' build

bun --filter '@scs/github-app' lint
bun --filter '@scs/github-app' typecheck
bun --filter '@scs/github-app' test
bun --filter '@scs/github-app' build

bun --filter '@scs/api' lint
bun --filter '@scs/api' typecheck
bun --filter '@scs/api' test
bun --filter '@scs/api' build

bun --filter '@scs/portal' lint
bun --filter '@scs/portal' typecheck
bun --filter '@scs/portal' test
bun --filter '@scs/portal' build
```

### Root Gate

```powershell
bun install --frozen-lockfile
bun run docs:check
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run build
git diff --check
git status --short
```

### Commit

```text
refactor: complete repository optimization program
```

### Status on 2026-10-21

- workspace Knip scans completed without findings for Web, People, Projects,
  Portal, API, and GitHub App;
- Portal has no consumer of the unbounded project or admin-user list routes,
  so those routes and their repository accumulation helper were removed;
- the unused singular `/api/user/permissions` mutation was removed in favor of
  the canonical `/api/admin/users/:email` contract;
- characterization tests now require all three retired routes to return `404`;
- academic course and offering array routes remain temporarily because the
  project and course editors still consume them as reference data;
- synchronous mutation adapters remain behind the documented compatibility
  boundary because no production access evidence was available to prove that
  every non-Portal caller has migrated;
- one-time authentication and proxy migration actions remain until an operator
  confirms their production migrations and reviews any reported conflicts.

## Completion Report

The final report must include:

- every commit hash by repository;
- every command run and its outcome;
- before/after GitHub call counts and Portal request/payload evidence;
- concurrency scenarios exercised;
- remote workflow/ruleset runs actually observed;
- any missing production-only or credential-dependent validation;
- confirmation that dirty Portal and People source repositories were untouched;
- confirmation that no Docker artifacts were added or built;
- exact remaining work, if any.

Do not call the program complete while any required root, workspace,
concurrency, documentation, or external workflow gate is failing or unverified.
