# Optimization Completion Report

## Scope and Date

This report records the verified repository state on 2026-10-21 after the
baseline migration and the 13-slice optimization program. It distinguishes
local verification from production-only and operator-owned work.

## Result

The monorepo baseline and local optimization gates are complete. Applications
and services remain independently deployable. No Docker artifact was added or
built. The existing dirty working trees in the Portal and People source
repositories were not read as migration inputs, modified, staged, or committed.

The final API review removed three compatibility routes with no known consumer:

- `GET /api/projects/v2/projects`;
- `GET /api/admin/users`;
- `PATCH /api/user/permissions`.

The paginated project and admin-user routes and the canonical
`PATCH /api/admin/users/:email` mutation remain. Academic array routes remain
because Portal editors still consume them. Synchronous mutation adapters and
one-time migration actions remain until production access and migration
evidence makes removal safe.

## Source State

| Repository             | Baseline source     | Current source-worktree observation |
| ---------------------- | ------------------- | ----------------------------------- |
| Portal                 | committed `eca1474` | dirty and untouched                 |
| People                 | committed `fdd3f9e` | dirty and untouched                 |
| Other migrated sources | committed `HEAD`    | imported from Git trees             |

The source repositories are not subdirectories of this monorepo and were not
used as mutable working directories during migration.

## Verification

The following final local commands completed successfully:

```powershell
bun install --frozen-lockfile
bun run docs:check
bun run format:check
bun run lint
bun run typecheck
bun run typecheck:test
bun run test
bun run build
git diff --check
```

The root tasks covered nine linting workspaces, ten source-TypeScript
workspaces, four test-TypeScript projects, seven test workspaces, and seven
build workspaces. The API suite passed 64 tests. The targeted GitHub App
operation suite passed 17 tests, and its call-characterization test passed.
Workspace Knip scans for Web, People, Projects, Portal, API, and GitHub App
reported no findings.

The final CI observation also identified Node 20 deprecation warnings from
`actions/checkout@v4` and `actions/cache@v4`. The workflows now use the current
Node 24 action majors, `actions/checkout@v7` and `actions/cache@v6`.

The targeted operation command exercised:

- duplicate delivery and idempotency-key reuse;
- same-resource serialization;
- parallel progress for unrelated resources;
- authoritative revision conflicts;
- provider-aware bounded retries;
- permanent failure without retry;
- recursive-tree repository reads and truncated-tree rejection.

## Performance Comparison

### Browser List Loading

Before optimization, one admin request returned 126 records and 20,171 bytes
despite `limit=10`. The project-management loader fetched projects, courses,
and offerings together before showing the list.

After optimization:

- the admin page requests 50 users per server-rendered page;
- the project list requests 24 projects per page;
- course and offering references load only when an editor opens;
- the API rejects page sizes above 100;
- retired unbounded routes return `404`;
- admin pages use KV metadata in bounded batches instead of one value read per
  listed user.

### GitHub Mutation Calls

The compatibility-path characterization remains unchanged:

| Mutation | Reads | Writes | Pull lists | Other calls |
| -------- | ----: | -----: | ---------: | ----------: |
| Course   |     4 |      2 |          2 |           6 |
| Offering |     4 |      2 |          2 |           6 |
| Project  |     6 |      3 |          2 |           6 |
| Profile  |    35 |      3 |          1 |           6 |

The optimization did not claim a synthetic call-count reduction for this
legacy path. It instead added durable idempotency, resource-scoped concurrency,
revision checks, atomic gateway behavior, and deterministic derived projections.
Production latency and GitHub quota measurements were not available.

## External Workflow Evidence

- Monorepo CI run `39565811945` passed for commit `42b9756`.
- Data validation run `39565749739` passed.
- Data deployment run `39565783046` validated and deployed exact commit
  `e085f76` through the event-driven workflow.
- Projection publication run `39565446829` passed with no generated changes.
- Config validation run `39565446905` passed.

## Commit Ledger

### Monorepo

The implementation began from approved design commit `4721d23`. The following
commits form the migration and optimization sequence through the final API
cleanup:

- `4721d23`, `c6e1a91`, `560884e`, `105a4a9`, `c3989ad`, `34886ac`;
- `acd3133`, `f5925f0`, `1c6ff89`, `6d046a7`, `42d8e94`, `cfe6da4`;
- `24f5139`, `c654fa3`, `49a5109`, `25953af`, `4b66a41`, `62af607`;
- `16df234`, `40de7f2`, `366d503`, `74822dd`, `02071fd`, `c737795`;
- `5fa4417`, `013f696`, `119adcc`, `c38d854`, `3e8e840`, `9cf7d83`;
- `70ccbd9`, `a932ec4`, `ac14bbd`, `3b29b8f`, `e67121b`, `540bf5a`;
- `25bc9cc`, `9bf7a2d`, `031c319`, `f7e8846`, `13def64`, `8c5b2b1`;
- `039f189`, `5925248`, `187f192`, `2c181dd`, `aa01b9c`, `cb53306`;
- `dc44340`, `d800b64`, `e3d38eb`, `897d725`, `b2092b7`, `4efe2ad`;
- `2e13511`, `5d685b7`, `7a71d23`, `149309b`, `1fbcac0`, `9aa251b`;
- `529133a`, `3d7082a`, `472866f`, `2640a51`, `07e712b`, `5939b8f`;
- `788b9cf`, `4ac8291`, `b414f2a`, `47b444a`, `1b09e9c`, `42b9756`;
- `40e3a8d`.

### Data Repository

- `12966fb` generates concurrency-safe public projections;
- `b6f3375` retires the scheduled deployment fallback;
- `e085f76` validates deployment workflow changes.

### Config Repository

- `450a4f0` validates serialized configuration updates.

## Remaining Operator Work

Local implementation is complete, but these external conditions remain:

1. Exercise a real merge-queue `merge_group` event and confirm repository
   rulesets require the intended checks for every contributor path.
2. Run and review the production Better Auth and proxy D1 migrations, then
   remove their one-time actions and legacy source variables.
3. Inspect production access evidence before removing synchronous mutation
   adapters used by any non-Portal caller.
4. Move the remaining academic reference consumers to bounded page traversal
   before retiring the course and offering array routes.
5. Collect production latency and GitHub quota data if operational performance
   targets require measurements beyond deterministic local tests.

These are deliberately not reported as verified. They require repository
settings, production state, or real traffic evidence unavailable to local
tests.
