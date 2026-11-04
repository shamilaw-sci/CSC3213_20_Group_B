---
title: Architecture
description: System boundaries, ownership, data flows, and deployment topology across the monorepo.
---

# Architecture

This guide explains the system boundaries and the reasons behind them. New
contributors should read the system map and ownership tables first. Maintainers
changing an API, data model, or deployment boundary should also read the flow
and dependency sections.

## System Context

The repository contains five Next.js applications, two Cloudflare Workers, one
Bun mail service, and five shared packages. Public records are published from a
separate Git repository.

```mermaid
flowchart TB
  subgraph Browsers
    PublicUser[Public visitor]
    PortalUser[Authenticated member]
  end

  subgraph Applications
    Web[apps/web]
    People[apps/people]
    Projects[apps/projects]
    Portal[apps/portal]
    Docs[apps/docs]
  end

  subgraph Services
    API[services/api]
    GitHubApp[services/github-app]
    Mailer[services/mailer]
  end

  subgraph Storage
    D1[(API D1: auth, proxy, and permission state)]
    DO[(GitHub App Durable Object SQLite)]
    Queue[Cloudflare Queue and DLQ]
    Data[Published public data]
  end

  subgraph GitHub
    DataRepo[data.scs.pdn.ac.lk]
  end

  PublicUser --> Web
  PublicUser --> People
  PublicUser --> Projects
  PublicUser --> Docs
  PortalUser --> Portal
  Web --> Data
  People --> Data
  Projects --> Data
  Portal --> API
  Web -->|authenticated personal-site lookup| API
  API --> D1
  API --> Mailer
  API --> GitHubApp
  GitHubApp --> DO
  GitHubApp <--> Queue
  GitHubApp --> DataRepo
  DataRepo --> Data
```

The key trust boundary is deliberate: browser applications never receive
GitHub App credentials. Portal calls the API Worker, and the API calls the
private GitHub App Worker through a service binding or authenticated HTTP
fallback.

## Workspace Responsibilities

| Workspace                | Owns                                                                                 | Must not own                                    |
| ------------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `apps/web`               | department content, public navigation, external learning links                       | authenticated administration                    |
| `apps/people`            | staff, student, alumni, and individual public profiles                               | profile mutation credentials                    |
| `apps/projects`          | project collections, search, and public project details                              | project write workflows                         |
| `apps/portal`            | sign-in UI and authorized management experiences                                     | provider secrets or direct repository writes    |
| `apps/docs`              | repository handbook, search, metadata, and agent-readable representations            | a second authored documentation source          |
| `services/api`           | Better Auth, sessions, authorization, D1 state, public API contracts                 | GitHub installation credentials                 |
| `services/github-app`    | installation authentication, durable mutations, branches, commits, and pull requests | browser sessions or UI authorization state      |
| `services/mailer`        | authenticated mail requests, React Email templates, and SMTP delivery                | application permissions                         |
| `packages/security`      | RFC 9116 document validation, generation, and discovery redirect policy              | authentication, authorization, or incident data |
| `packages/schemas`       | shared Zod schemas and transport types                                               | provider-specific runtime configuration         |
| `packages/ui`            | reusable shadcn primitives and shared UI hooks                                       | product workflows or page compositions          |
| `packages/tsconfig`      | compiler presets                                                                     | workspace file lists and runtime entry points   |
| `packages/eslint-config` | shared lint policy                                                                   | product-specific exceptions without evidence    |

## Read and Write Paths

Public applications read published projections. They do not call GitHub for
page rendering.

```mermaid
sequenceDiagram
  participant Browser
  participant App as Public Next.js app
  participant Data as Public data service
  participant Repo as Data repository

  Repo->>Data: Publish validated projections
  Browser->>App: Request page
  App->>Data: Fetch validated JSON record or projection
  Data-->>App: Public JSON
  App-->>Browser: Rendered page
```

Authenticated writes are durable operations. A logical mutation is identified
by an idempotency key and guarded by the last known entity revision.

```mermaid
sequenceDiagram
  actor User
  participant Portal
  participant API
  participant Queue as Operation queue
  participant Worker as GitHub App Worker
  participant GitHub

  User->>Portal: Submit validated edit
  Portal->>API: Mutation + idempotency key + revision
  API->>Worker: Submit operation
  Worker->>Queue: Enqueue by resource identity
  Worker-->>API: 202 Accepted + operation ID
  API-->>Portal: Pollable operation resource
  Queue->>Worker: Execute mutation
  Worker->>GitHub: Compare revision, commit, open/update PR
  GitHub-->>Worker: Repository result
  Portal->>API: Poll operation status
  API-->>Portal: succeeded, failed, or conflicted
```

## State Ownership

| State                                                                 | Authoritative owner        | Notes                                           |
| --------------------------------------------------------------------- | -------------------------- | ----------------------------------------------- |
| users, accounts, sessions, verification, passkeys                     | API D1 database            | managed through Better Auth and API migrations  |
| personal-site redirect settings and edit-attempt state                | API D1 database            | updates consume attempts atomically             |
| application roles, access levels, blacklist, notification preferences | API D1 database            | checked on protected requests                   |
| person, project, course, and offering entity records                  | data repository            | individual entity files are authoritative       |
| aggregate arrays, manifests, search indexes, `by-person` files        | generated projections      | reproducible from authoritative records         |
| durable mutation status                                               | GitHub App Durable Objects | keyed by operation and resource identity        |
| same-resource mutation leases                                         | GitHub App Durable Objects | keyed by resource identity for serialization    |
| queued delivery and retry state                                       | Cloudflare Queues          | exhausted retries move to the dead-letter queue |

Never introduce a second writable owner for the same state. Caches and
projections must be disposable and reproducible.

### Cloudflare Storage Boundaries

The API D1 database and GitHub App Durable Object storage are independent
resources:

- `AUTH_DB` D1 stores Better Auth tables, rate limits, personal-site redirect settings, and one
  permission record per user. Permission records include role, access level,
  blacklist state, repository include/exclude rules, notification preferences,
  and display metadata.
- `OPERATION_STATE` creates one Durable Object per operation ID. Its private
  SQLite database stores that operation record.
- `MUTATION_COORDINATOR` creates one Durable Object per resource key. Its
  private SQLite database stores the current mutation lease.

Durable Object SQLite is not a table or schema inside `AUTH_DB`. A D1 migration
does not migrate or modify Durable Object storage, and rolling back Worker code
does not roll back either resource's persisted data.

## Durable Operation Lifecycle

```mermaid
stateDiagram-v2
  [*] --> queued
  queued --> running
  queued --> cancelled
  running --> succeeded
  running --> conflicted
  running --> failed
  running --> queued: retryable failure
  queued --> failed: retry limit reached
```

Operations for the same logical resource are serialized. Unrelated resources
may proceed concurrently. Reusing an idempotency key with different input is a
contract error, not a second mutation.

## Dependency Direction

```mermaid
flowchart BT
  Domain[Domain rules and schemas]
  UseCases[Application use cases]
  Adapters[Next.js, HTTP, D1, GitHub, SMTP adapters]

  UseCases --> Domain
  Adapters --> UseCases
  Adapters --> Domain
```

Domain modules do not import Next.js, Hono, Cloudflare bindings, Octokit, or UI
frameworks. Adapters translate external input into validated domain values.
Create a shared abstraction only when it has a stable owner and more than a
visual resemblance to another file.

## Application UI Ownership

The four product applications share a visual system, not one universal shell.
Web keeps an institutional navigation model, People and Projects keep
discovery-oriented navigation, and Portal keeps an authenticated workspace
shell. Docs uses Fumadocs for its documentation-specific shell while reusing
repository primitives for failure states. Each deployable owns the composition,
labels, destinations, and permission-aware behavior appropriate to its users.

Reusable shadcn primitives, theme initialization, semantic theme tokens,
feedback surfaces, and primitive-level hooks belong in `packages/ui`. Product
components that combine primitives with application routes, data, copy, or
permissions remain in their owning application. Do not move a composed header,
editor, dashboard, or domain workflow into `packages/ui` merely because another
application has a visually similar surface.

Within a Next.js application, use these ownership rules:

- `app` owns routes, layouts, metadata, server orchestration, and Next.js
  special files such as `error.tsx`, `global-error.tsx`, `not-found.tsx`, and
  `global-not-found.tsx`;
- a route's private composition belongs in its colocated `_components` folder;
- UI reused by multiple routes belongs in `components/<responsibility>`, such
  as `components/layout`, `components/editor`, or a named domain folder;
- `lib` owns non-visual helpers, data access, and client or server adapters;
- use `@/` and package exports for cross-directory imports rather than creating
  path-dependent component trees.

Applications do not use generic `src/views` or `components/custom` layers. Keep
route-only compositions beside their route, and promote a composition to a
named responsibility or domain folder only when multiple routes reuse it. Do
not recreate either ambiguous layer as a second route or component tree.

### Web Editorial Content Ownership

The department Web application keeps durable editorial content in local MDX
route files. MDX owns prose, section order, page metadata, and links;
app-owned React components provide the shared institutional shell, accessible
page introductions, section layout, and responsive presentation. This keeps
content reviewable without introducing a second publishing framework or a
remote runtime content dependency.

Web publishes department-owned pages for About, undergraduate and postgraduate
study, research overview, resources, services, societies, prizes and
scholarships, and contact information. It does not reproduce records owned by
People or Projects. Navigation uses configured public origins and native links
for People, Projects, and Moodle so crossing an application boundary is a
full document request rather than a Next.js RSC prefetch. `/people`, `/projects`,
and `/moodle` remain permanent redirect fallbacks for direct inbound URLs
and are excluded from Web's sitemap.

Home-only compositions stay in `app/_components`. Editorial compositions used
by several MDX routes stay in `components/content`; they are product-specific
and do not belong in `packages/ui`.

### Projects Discovery Ownership

The Projects application is a public showcase, not a second academic catalog.
It derives navigation from the shared project contract and owns these route
families:

- `/browse` for the bounded all-projects directory;
- `/types/[type]`, `/categories/[category]`, and `/topics/[topic]` for
  schema-backed collections;
- `/search/[query]` for path-based search;
- `/projects/[project_slug]` for canonical details and `/p/[project_slug]` for
  permanent short-link redirects.

Collection pagination appends `/page/[page]`. Discovery controls do not create
query-string state, and old discovery parameters are discarded rather than
translated into another competing URL model. Sitemap entries include
published collections and canonical project details, but exclude search and
short redirects.

Category, topic, and search segments share one Unicode-aware canonicalizer.
It normalizes case, whitespace, and path delimiters, rejects empty or
browser-reserved segments, and percent-encodes remaining reserved characters.
Collection pages publish their own canonical metadata; search pages remain
outside the sitemap and are marked not to be indexed. A controlled project
type with no records is a valid empty collection, while an unpublished
category or topic is a missing collection.

Projects may display a project's course and offering fields as context. The
department Web application owns course catalogs and their destinations;
Projects must not add `/courses` or `/offerings` directories or infer a course
URL from a course code. Until Web or the shared contract supplies a stable
per-course destination, course metadata remains text and navigation may point
only to known Web course indexes.

### Portal Editor State

Project, course, offering, and public-profile editors use one canonical draft
across Edit, Review, and Advanced JSON surfaces. Published data is a read-only
comparison source, never an editable mode. Changing surfaces must not replace
the draft, selected record, revision, or permission context.

Advanced JSON is secondary to the guided form. If its text differs from the
canonical draft, leaving it requires an explicit Apply, Discard, or Stay
decision. Apply parses and validates the domain record before updating the
canonical draft. Final submission continues to use the existing authorized,
revision-protected, idempotent operation flow; the UI state machine does not
change API payloads or grant permissions.

## Configuration and Contracts

- Runtime variables are parsed in each workspace's `src/config` modules.
- Cross-workspace domain and transport contracts come from `@scs/schemas`.
- TypeScript and ESLint policy comes from the shared config packages.
- Browser-safe configuration is explicitly prefixed `NEXT_PUBLIC_`.
- Cloudflare bindings remain request-scoped; they are not copied into
  `process.env`.

See [Environment Variables](ENVIRONMENT_VARIABLES.md),
[API Contracts](API_CONTRACTS.md), and [Schemas](SCHEMAS.md) for implementation
details.

## Deployment Boundaries

Every app and service builds and deploys independently. Root Turbo commands are
verification orchestration, not a combined release. A shared-package change may
require several deployables to rebuild; a service-only change should not force
an unrelated app deployment.

The public data repository has separate validation, publication, and deployment
workflows. Changes to that repository require their own review and must not be
hidden inside a monorepo deployment.

## Changing the Architecture

Before changing a boundary:

1. identify the current owner of the data or behavior;
2. trace every producer and consumer;
3. update the shared schema or API contract first when the shape changes;
4. preserve idempotency, authorization, and deployment independence;
5. add tests at the boundary, not only inside an implementation module;
6. update this guide and the relevant operations/security documentation;
7. run the complete root gate.
