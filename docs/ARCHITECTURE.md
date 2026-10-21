# Architecture

This guide explains the system boundaries and the reasons behind them. New
contributors should read the system map and ownership tables first. Maintainers
changing an API, data model, or deployment boundary should also read the flow
and dependency sections.

## System Context

The repository contains four Next.js applications, two Cloudflare Workers, one
Bun mail service, and four shared packages. Public records and repository-access
configuration are published from separate Git repositories.

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
  end

  subgraph Services
    API[services/api]
    GitHubApp[services/github-app]
    Mailer[services/mailer]
  end

  subgraph Storage
    D1[(D1)]
    KV[(KV)]
    Data[Published public data]
  end

  subgraph GitHub
    DataRepo[data.scs.pdn.ac.lk]
    ConfigRepo[config.scs.pdn.ac.lk]
  end

  PublicUser --> Web
  PublicUser --> People
  PublicUser --> Projects
  PortalUser --> Portal
  Web --> Data
  People --> Data
  Projects --> Data
  Portal --> API
  API --> D1
  API --> KV
  API --> Mailer
  API --> GitHubApp
  GitHubApp --> DataRepo
  GitHubApp --> ConfigRepo
  DataRepo --> Data
```

The key trust boundary is deliberate: browser applications never receive
GitHub App credentials. Portal calls the API Worker, and the API calls the
private GitHub App Worker through a service binding or authenticated HTTP
fallback.

## Workspace Responsibilities

| Workspace                | Owns                                                                                 | Must not own                                  |
| ------------------------ | ------------------------------------------------------------------------------------ | --------------------------------------------- |
| `apps/web`               | department content, public navigation, external learning links                       | authenticated administration                  |
| `apps/people`            | staff, student, alumni, and individual public profiles                               | profile mutation credentials                  |
| `apps/projects`          | project discovery, filtering, and public project details                             | project write workflows                       |
| `apps/portal`            | sign-in UI and authorized management experiences                                     | provider secrets or direct repository writes  |
| `services/api`           | Better Auth, sessions, authorization, D1/KV state, public API contracts              | GitHub installation credentials               |
| `services/github-app`    | installation authentication, durable mutations, branches, commits, and pull requests | browser sessions or UI authorization state    |
| `services/mailer`        | authenticated mail requests and SMTP delivery                                        | application permissions                       |
| `packages/schemas`       | shared Zod schemas and transport types                                               | provider-specific runtime configuration       |
| `packages/ui`            | reusable shadcn primitives and shared UI hooks                                       | product workflows or page compositions        |
| `packages/tsconfig`      | compiler presets                                                                     | workspace file lists and runtime entry points |
| `packages/eslint-config` | shared lint policy                                                                   | product-specific exceptions without evidence  |

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
  App->>Data: Fetch bounded JSON record or index
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
| proxy settings and edit-attempt state                                 | API D1 database            | updates consume attempts atomically             |
| application roles, access levels, blacklist, notification preferences | API KV namespace           | checked on protected requests                   |
| person, project, course, and offering entity records                  | data repository            | individual entity files are authoritative       |
| aggregate arrays, manifests, search indexes, `by-person` files        | generated projections      | reproducible from authoritative records         |
| repository permission configuration                                   | config repository          | changed through reviewed GitHub automation      |
| durable mutation status                                               | GitHub App Durable Objects | keyed by operation and resource identity        |
| queued delivery and retry state                                       | Cloudflare Queues          | exhausted retries move to the dead-letter queue |

Never introduce a second writable owner for the same state. Caches and
projections must be disposable and reproducible.

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
  Adapters[Next.js, HTTP, D1, KV, GitHub, SMTP adapters]

  UseCases --> Domain
  Adapters --> UseCases
  Adapters --> Domain
```

Domain modules do not import Next.js, Hono, Cloudflare bindings, Octokit, or UI
frameworks. Adapters translate external input into validated domain values.
Create a shared abstraction only when it has a stable owner and more than a
visual resemblance to another file.

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

The public data and config repositories have separate validation, publication,
and deployment workflows. Changes to those repositories require their own
review and must not be hidden inside a monorepo deployment.

## Changing the Architecture

Before changing a boundary:

1. identify the current owner of the data or behavior;
2. trace every producer and consumer;
3. update the shared schema or API contract first when the shape changes;
4. preserve idempotency, authorization, and deployment independence;
5. add tests at the boundary, not only inside an implementation module;
6. update this guide and the relevant operations/security documentation;
7. run the complete root gate.
