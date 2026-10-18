# Repository Optimization Design

**Status:** Approved

**Approved:** 2026-10-19

**Maintenance horizon:** 10–15 years

## Purpose

This document defines the target architecture for improving the SCS PDN
monorepo after its baseline migration. The work is an evolutionary
modernization, not a wholesale rewrite. Each slice must preserve deployed
behavior, add or retain verification evidence, and remain independently
reversible until the replacement path has passed its gates.

The design covers:

- repository and documentation cleanup;
- API and GitHub App modularization;
- safe concurrent mutations by multiple users;
- GitHub API latency, rate-limit, retry, and conflict handling;
- Portal rendering, pagination, and bundle reduction;
- external data/configuration repository workflows;
- long-term portability, operations, and maintenance.

## Current Evidence

The initial audit found the following concrete problems:

- Documentation is distributed across workspace-local `docs` folders, copied
  source-repository READMEs, migration ledgers, and Superpowers artifacts.
- The untracked `.superpowers` directory contains generated migration work and
  copied repository snapshots. It is local tooling state, not product source.
- GitHub repository modules contain repeated encoding, file access, default
  branch, branch reset, pull-request lookup, and error-handling code.
- Profile and project repository modules are close to or above 1,000 lines.
- A profile update can read and write many aggregate files and then read every
  public user file to regenerate the search index.
- Multi-file mutations use repeated Contents API calls, producing several
  commits and long synchronous request chains.
- Different entity PRs edit the same aggregate, manifest, search, or
  `by-person` files, creating conflicts between otherwise unrelated users.
- The Portal project list eagerly downloads projects, courses, and offerings.
- Admin user listing scans KV keys and reads as many as 1,000 records before
  returning one unpaginated response.
- Core Portal editors contain between roughly 1,200 and 2,600 lines and place
  data loading, mutation state, validation, rendering, and navigation in the
  same client component.
- The external public-data workflow enables auto-merge per PR but does not
  coordinate PRs that share generated files.
- External validation formats files before checking formatting, which can hide
  drift rather than report it.
- Public-data deployment is schedule-driven rather than tied to a verified,
  publishable main-branch state.

These observations define the scope. Cleanup must not be used as a reason for
unrelated product redesign.

## Architectural Principles

### Evolution Over Replacement

New paths are introduced behind characterized contracts. Existing clients are
migrated before compatibility code is removed. A slice is complete only after
its focused tests and the applicable workspace gates pass.

### Stable Core, Replaceable Edges

Domain rules and contracts must not depend directly on Next.js, Hono,
Cloudflare, Octokit, GitHub Actions, or Bun. Those systems are adapters around
plain TypeScript domain functions and versioned schemas.

The target dependency direction is:

```text
UI / HTTP / Queue / GitHub / KV adapters
                  |
          application use cases
                  |
       domain rules and contracts
```

Domain code must not import upward into adapters.

### One Authoritative Representation

Individual people, project, course, and offering records are authoritative.
Aggregate arrays, search indexes, manifests, paginated snapshots, and
`by-person` indexes are derived projections. They must be reproducible from
authoritative records and must not contain independently maintained facts.

### Explicit Compatibility

HTTP request and response contracts are versioned through `@scs/schemas`.
Breaking changes require a new version or a documented compatibility period.
Existing synchronous mutation endpoints remain available while the Portal is
migrated to asynchronous operations.

### Bounded Dependencies

Prefer Web APIs, Git object semantics, JSON-compatible contracts, and small
adapters over framework-specific abstractions. A dependency must remove more
maintenance burden than it adds. New infrastructure must have a local test
implementation and an operational recovery path.

## Target Repository Organization

Product documentation will live under the root `docs` directory. Markdown
filenames must use uppercase snake case, such as `API_CONTRACTS.md`. `README.md`
is the conventional allowed single-word form.

The intended durable documentation set is:

```text
README.md
docs/
  API_CONTRACTS.md
  ARCHITECTURE.md
  DEVELOPMENT.md
  OPERATIONS.md
  REPOSITORY_OPTIMIZATION_DESIGN.md
  SECURITY.md
  SCHEMAS.md
```

Documents may be split further only when a file has a distinct owner or
audience. Any additional Markdown file must follow the same naming convention.

Workspace READMEs and workspace-local documentation will be removed after
their durable operational content is moved to the root documentation. The old
migration plan, migration ledger, source-copy documentation, and Superpowers
planning artifacts will be deleted rather than preserved as active product
documentation.

The repository will track `skills-lock.json` but not installed skill payloads,
agent caches, `.superpowers`, or other generated local assistant state. Those
paths will be explicitly ignored.

## API Boundaries

### Shared Contracts

Request payloads, operation status, pagination envelopes, errors, and public
domain entities belong in `@scs/schemas`. Runtime services consume the same
schemas used by Portal clients. Local schemas remain only for adapter-specific
configuration that is not part of an inter-service contract.

### Internal Service Client

The API service will have one GitHub App client adapter responsible for:

- resolving the service endpoint;
- authenticating internal requests;
- applying timeouts;
- parsing success and error envelopes;
- mapping transport failures;
- propagating request and operation identifiers;
- implementing bounded, safe retries for idempotent requests.

Domain services must not reproduce `fetch` and error-handling helpers.

When API and GitHub App Workers are deployed within the same Cloudflare
account, a service binding is preferred. The HTTP adapter remains supported for
independent deployment and local Bun execution.

## Mutation Operation Model

### HTTP Contract

New mutation endpoints return `202 Accepted` and an operation resource:

```json
{
  "id": "operation-id",
  "status": "queued",
  "resource": "project/example-project",
  "submittedAt": "2026-10-19T00:00:00.000Z"
}
```

The operation status is one of:

- `queued`
- `running`
- `waiting_for_checks`
- `merged`
- `conflict`
- `failed`
- `cancelled`

Clients obtain current state through a status endpoint. The Portal may poll
with bounded backoff initially; the contract must allow a future event stream
without changing operation semantics.

### Idempotency

Every mutation accepts an idempotency key. The key is scoped to the actor,
operation kind, and target resource. Replaying the same key and payload returns
the original operation. Reusing a key with a different payload returns a
conflict.

Queue delivery is treated as at-least-once. The operation store therefore
deduplicates before producing GitHub side effects. GitHub branch names, commit
messages, comments, and pull requests include the operation identity where
appropriate so recovery can reconcile partially completed work.

### Concurrency

Concurrency is controlled at the narrowest correct resource boundary:

- different registries may progress concurrently;
- different entity records may be prepared concurrently;
- two writes to the same entity are serialized;
- publication steps that update one repository branch are coordinated;
- no lock is held across an unbounded external GitHub request.

The user-visible revision is the authoritative entity blob SHA or equivalent
version, not the aggregate file SHA and not merely a PR head SHA. A stale
revision returns `409 Conflict` with the current revision and enough structured
context for the Portal to offer reload, compare, or retry. The service never
silently overwrites a newer edit.

### Portable Execution

Application use cases depend on an operation executor interface. The initial
production adapter may use Cloudflare Queues plus a durable coordination/store
adapter. Local development and unit tests use an in-process executor with the
same contract. Queue-specific message types do not cross into domain modules.

Retries are classified:

- validation and authorization failures are permanent;
- stale entity revisions are explicit conflicts;
- GitHub rate limits and transient upstream errors are retryable with bounded
  exponential backoff and provider-specified retry timing;
- exhausted operations enter a failed or dead-letter state with a recovery
  command and audit entry.

## GitHub Integration

### Repository Gateway

Repeated Octokit behavior will be consolidated into a repository gateway that
owns:

- installation authentication;
- repository/default-branch lookup;
- file and tree reads;
- atomic multi-file commit creation;
- branch creation and compare-and-set updates;
- pull-request lookup, creation, update, comments, and labels;
- typed provider-error classification;
- rate-limit metadata and retry decisions.

The gateway uses Git blobs, trees, commits, and reference updates to publish a
logical mutation in one commit. It must compare the expected branch head before
updating a reference. A failed compare does not force-push over another writer.

Installation clients and stable repository metadata may be reused safely, but
request-specific identity and mutable operation state must never be stored in
module globals.

### Pull Requests

There is at most one active automation operation per entity. A subsequent edit
to the same entity either updates the controlled draft after verifying its
revision or reports a conflict. Branch and PR discovery must use operation
metadata, not only name prefixes or a fixed first page of results.

Audit bodies record the operation ID, actor, entity revision, authoritative
files, and action. Human-readable comments supplement structured metadata but
are not parsed as the only source of control state.

### Derived Data

Entity PRs stop editing shared projections. The external data repository owns
a deterministic generator that rebuilds:

- people aggregates and search indexes;
- project aggregate, manifest, and `by-person` indexes;
- course and offering aggregates;
- paginated list artifacts where the public-data deployment benefits from
  precomputation.

Generation must be deterministic, formatting-stable, and covered by snapshot
or fixture tests. CI must fail when committed projections do not match their
sources, or a serialized post-merge publisher must regenerate them before
deployment. The final workflow choice must never expose a state where a new
entity is published without the projections required to discover it.

## External Repository Workflows

Changes to `data.scs.pdn.ac.lk` and `config.scs.pdn.ac.lk` are limited to the
workflow, generator, validation, and publication behavior required by this
design. They are separate deployment units and receive separate commits and
verification. The dirty `portal.scs.pdn.ac.lk` and `people.scs.pdn.ac.lk`
source repositories remain untouched.

The public-data repository will:

- validate pull requests and merge groups;
- use a merge queue or equivalent serialized publication path for `main`;
- run required checks against the exact candidate merge state;
- remove formatter mutations from check-only validation;
- generate or verify derived projections deterministically;
- deploy after a verified publishable main state rather than waiting only for
  a periodic schedule;
- retain manual deployment and recovery paths;
- prevent untrusted branches from obtaining write credentials.

The configuration repository will receive equivalent idempotency, validation,
and serialization treatment where concurrent config PRs can touch shared
files. Repository ruleset changes that cannot be expressed in source will be
documented as explicit operator actions and will not be reported as completed
without verification.

## Portal Performance Design

### Server-First Pages

App Router pages load initial data in Server Components. Client Components are
reserved for input state, browser APIs, interactive editors, and mutation
feedback. Authentication, initial list loading, and stable reference data are
not delayed until a mount effect when they can be resolved on the server.

Slow or independent regions use meaningful Suspense boundaries. A route should
render its useful shell and first page without waiting for editor-only data.

### Pagination

Project, course, offering, user, proxy, and other potentially growing lists use
bounded pagination contracts:

```json
{
  "items": [],
  "pageInfo": {
    "nextCursor": null,
    "previousCursor": null,
    "hasNextPage": false
  }
}
```

Cursors are opaque and stable for the chosen sort. Page size has a documented
default and maximum. Filtering and sorting occur at the data boundary rather
than after downloading the entire dataset. Route search parameters preserve
pagination, filtering, and search state so navigation is linkable and works
without hidden client-only state.

The Portal will use ordinary accessible previous/next pagination first.
Infinite scrolling is not required and must not replace navigable URLs.

### Deferred Data

The project list does not load courses or offerings. Those datasets load only
when a user opens an editor that requires course-project validation. Detail
routes load one entity and its operation status, not the full registry.

### Admin Users

The permissions repository exposes a KV-cursor page rather than an all-users
scan. List fields are stored in KV metadata when permissions are written so a
table page does not need one KV value read per user. Existing entries receive a
safe lazy or explicit backfill path. Sensitive permission details remain in
the value and are fetched only for the selected user.

### Component Boundaries

Large editors will be separated into:

- server route/loaders;
- domain transformation and validation modules;
- operation hooks or controllers;
- list/table views;
- focused form sections;
- JSON/editor views loaded only when selected.

Splitting must follow responsibilities and test seams. Arbitrary one-function
files and new barrel files are not goals.

## Security

Internal authentication uses constant-time secret comparison or platform
service identity where available. Secrets never appear in tracked examples,
logs, operation records, PR bodies, or error responses.

Mutation authorization is checked when an operation is accepted and again
before its side effect when permissions may have changed. Operation status is
visible only to the actor or an authorized administrator.

All user-controlled repository paths, branch metadata, cursors, operation
identifiers, and redirect targets are schema-validated. Provider errors are
logged with correlation identifiers while user responses remain bounded and
non-sensitive.

## Observability and Operations

Every request and background operation carries a correlation ID and structured
fields for operation ID, actor class, resource, attempt, provider request ID,
duration, outcome, and conflict category. Logs must not contain secrets or
unredacted private records.

Operational documentation defines:

- queue backlog and failed-operation inspection;
- idempotent replay;
- dead-letter recovery;
- stale branch and PR reconciliation;
- projection regeneration;
- GitHub rate-limit response;
- rollback of each deployment unit;
- local execution without production credentials.

## CI and Verification

The monorepo workflow will use cancellation for superseded pull-request runs,
retain non-cancelling main-branch verification, and run only sound affected
work while preserving a full main gate. Required checks must not be skipped by
path filters that omit relevant root configuration.

The verified root gate remains:

```powershell
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run build
```

Additional focused suites cover:

- GitHub provider error and rate-limit classification;
- atomic multi-file commits;
- idempotent duplicate delivery;
- concurrent edits to the same entity;
- unrelated concurrent entity edits;
- stale revision conflicts;
- retry exhaustion and recovery;
- deterministic projection generation;
- pagination stability and boundary behavior;
- Portal list and editor request counts;
- compatibility responses during migration.

No Docker build is part of this program unless separately requested.

## Implementation Sequence

Implementation will proceed in independently committed, verification-gated
slices:

1. Clean local/generated artifacts and consolidate documentation.
2. Record performance, request-count, and concurrency characterization tests.
3. Extract shared contracts and internal service clients.
4. Introduce the GitHub repository gateway and atomic commit builder.
5. Add the operation, idempotency, and conflict model behind compatibility
   endpoints.
6. Add the portable executor and production queue/coordination adapters.
7. Convert entity mutations and deterministic projections one registry at a
   time.
8. Add cursor-paginated APIs and KV metadata-backed user listing.
9. Move Portal list routes to server-first paginated rendering and split editor
   boundaries.
10. Correct external validation, merge, generation, and deployment workflows.
11. Remove compatibility code only after all consumers and operations are
    verified.
12. Run final root, per-workspace, concurrency, and external workflow gates.

Each slice must diagnose failed gates rather than bypass them. No slice may
claim an external workflow or ruleset is complete when it was only described
locally.

## Success Criteria

The program is complete only when:

- active product documentation is consolidated under root `docs` with the
  required naming convention;
- local skill and Superpowers payloads are not tracked;
- GitHub logical mutations use one atomic commit and are idempotent;
- concurrent unrelated users do not conflict through derived files;
- same-entity edits produce deterministic merge or explicit conflict results;
- Portal list routes fetch only one bounded page and no editor-only registries;
- admin user listing is cursor-paginated without an all-record value scan;
- operation failures are observable and recoverable;
- external checks validate the candidate merge state and deployment follows a
  verified publishable state;
- all affected workspace gates and the final root gate pass;
- source repositories excluded from this program remain untouched.
