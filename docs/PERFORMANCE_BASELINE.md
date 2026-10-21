# Performance Baseline

This document records deterministic local characterization captured before the
repository and API redesign. It is a comparison baseline, not a production
latency report. No production timing, GitHub quota, or network throughput data
was collected for this slice.

Measured on 2026-10-19 with Bun 1.4.3 and mocked external GitHub calls.

## GitHub Mutation Calls

The call-count test executes one new mutation of each family against an empty
in-memory GitHub model. Counts include the final status read performed by the
current repository implementation.

| Mutation     | Content reads | File writes | Pull-list calls | Other GitHub calls |
| ------------ | ------------: | ----------: | --------------: | -----------------: |
| Config/proxy |             4 |           2 |               2 |                  5 |
| Course       |             4 |           2 |               2 |                  6 |
| Offering     |             4 |           2 |               2 |                  6 |
| Project      |             6 |           3 |               2 |                  6 |
| Profile      |            35 |           3 |               1 |                  6 |

“Other” includes repository/ref lookup, branch creation or reset, pull-request
creation, and two label calls. These figures intentionally expose the profile
repository's broad candidate-file scan and search-index regeneration. They do
not estimate GitHub latency.

Run the measurement:

```powershell
bun --filter '@scs/github-app' test tests/github-call-characterization.test.ts
```

## List Payload and Request Shape

The admin-users characterization seeds 125 ordinary users plus one admin. A
request containing `?limit=10` still returns one bare array with all 126 users:

| Fixture     | Records returned | UTF-8 response bytes | Cursor metadata |
| ----------- | ---------------: | -------------------: | --------------- |
| Admin users |              126 |               20,171 | None            |

The Portal project-list loader performs three concurrent full-registry
requests: projects, courses, and offerings. None sends a limit or cursor. The
admin user view likewise fetches the complete users endpoint and stores the
entire result in client state.

Run the measurements:

```powershell
bun --filter '@scs/api' test test/characterization/paginated-lists.test.ts
bun --filter '@scs/portal' test test/project-data.test.ts test/user-list.test.ts
```

### Post-Migration List Contract

Verified on 2026-10-21:

- the Portal project list requests one 24-record page and loads course and
  offering reference data only after an editor opens;
- the Portal admin-user page requests one 50-record server-rendered page;
- the API limits every page to at most 100 records and rejects larger limits;
- the old unbounded project and admin-user list routes return `404`;
- admin-user pages read KV metadata in bounded batches instead of issuing one
  value read per listed user.

The original byte count above remains a reproducible historical baseline. A
single replacement byte count would be misleading because the new response
size depends on the requested page size and record contents; the enforced
record bounds and request-shape tests are the stable comparison.

## Source Size Baseline

Source size is reported because large client components couple fetching,
normalization, authorization presentation, editor state, and mutations. Byte
counts are filesystem bytes; line counts use PowerShell `Get-Content`.

| File                                | Lines |  Bytes |
| ----------------------------------- | ----: | -----: |
| Portal project management component | 2,561 | 82,946 |
| Portal course management component  | 1,294 | 41,566 |
| Portal admin user loader            |    79 |  1,933 |
| GitHub profile repository           | 1,120 | 31,580 |
| GitHub project repository           | 1,082 | 30,337 |
| GitHub academic repository          |   671 | 19,034 |

Reproduce the source measurements from the repository root:

```powershell
$files = @(
  'apps/portal/src/components/custom/project-management-page/ProjectManagementPage.tsx',
  'apps/portal/src/components/custom/course-management-page/CourseManagementPage.tsx',
  'apps/portal/src/views/manage/ManageUsers.tsx',
  'services/github-app/src/repositories/public-profile.repo.ts',
  'services/github-app/src/repositories/public-project.repo.ts',
  'services/github-app/src/repositories/public-course.repo.ts'
)

foreach ($file in $files) {
  $item = Get-Item -LiteralPath $file
  $lines = (Get-Content -LiteralPath $file).Count
  "$file`t$lines lines`t$($item.Length) bytes"
}
```

## Concurrency Baseline

The characterization suite records three contract weaknesses that later slices
must remove:

- duplicate mutation deliveries carry neither an operation ID nor an
  idempotency key;
- an initial same-entity mutation may omit the expected head SHA;
- unrelated records use distinct canonical files but share aggregate and
  manifest files, creating avoidable merge and overwrite collision domains.

Run the contract cases:

```powershell
bun --filter '@scs/github-app' test tests/concurrent-mutations.test.ts
```
