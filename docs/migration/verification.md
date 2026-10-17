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
