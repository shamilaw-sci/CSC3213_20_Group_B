---
title: Operations
description: Deployment, migrations, recovery, provider setup, and production validation procedures.
---

# Operations

This runbook covers verification, deployment boundaries, migrations,
observability, and recovery. Commands are examples; production actions still
require the target provider credentials and repository/environment approvals.

## Deployment Topology

```mermaid
flowchart LR
  subgraph Independently deployed apps
    Web[Web]
    People[People]
    Projects[Projects]
    Portal[Portal]
    Docs[Docs]
  end

  subgraph Services
    API[API Worker]
    GH[GitHub App Worker]
    Mailer[Mailer]
  end

  subgraph Cloudflare state
    D1[(D1)]
    DO[(Durable Objects)]
    Queue[Queue + DLQ]
  end

  Portal --> API
  API --> D1
  API --> GH
  API --> Mailer
  GH --> DO
  GH --> Queue
```

Root commands verify the repository; they do not deploy all units together.
Docker is not part of the current build or deployment process.

## Deployment Units

| Unit              | Runtime           | Local production check         | Deployment owner         |
| ----------------- | ----------------- | ------------------------------ | ------------------------ |
| five apps         | Next.js           | workspace `build`              | app hosting platform     |
| `@scs/api`        | Cloudflare Worker | `wrangler build`               | `wrangler deploy`        |
| `@scs/github-app` | Cloudflare Worker | `wrangler build`               | `wrangler deploy`        |
| `@scs/mailer`     | Bun/Hono          | `typecheck` and `check`        | service hosting platform |
| public data       | Cloudflare assets | separate repository validation | data repository workflow |

## Pre-Deployment Checklist

1. Confirm the exact commit and a clean working tree.
2. Review the diff for configuration, migrations, bindings, and secrets.
3. Run the owning workspace gate.
4. For shared changes, run the complete root gate.
5. Confirm required provider secrets and bindings without printing values.
6. Apply database or Durable Object migrations before code that requires them.
7. Deploy only affected units in dependency order.
8. Check health, logs, queue depth, and one representative user flow.
9. Record any production-only validation that was not possible locally.

Complete root gate:

```powershell
bun install --frozen-lockfile
bun run docs:check
bun run test:repo
bun run knip
bun run format:check
bun run lint
bun run typecheck
bun run typecheck:test
bun run test
bun run build
git diff --check
```

## Documentation Application

Deploy `@scs/docs` independently from `apps/docs`. Configure
`NEXT_PUBLIC_DOCS_SITE_URL` to its canonical origin and keep the hosting output
at `.next`. The workspace Turbo task includes root `docs/**` as an input and
caches the complete build output.

After deployment, verify the handbook, static search, sitemap, robots,
`llms.txt`, `llms-full.txt`, and one per-page Markdown URL. These are public
representations of the same root Markdown corpus.

## API Worker

The API Worker owns Better Auth, D1 migrations, permissions, browser API
routes, and the private calls to Mailer and GitHub App.

From `services/api`:

```powershell
bun run lint
bun run typecheck
bun run typecheck:test
bun run test
bun run build
bun run deploy
```

Configure the secrets listed in [Environment Variables](ENVIRONMENT_VARIABLES.md)
before deployment. `AUTH_DB` and `GITHUB_APP` bindings must point
to the intended environment.

Both Worker configurations declare required secret names. A deployment fails
instead of silently publishing an unusable Worker when one is missing. Set
values with `bunx wrangler secret put`; never add secret values to
`wrangler.jsonc`.

### D1 Migrations

The preferred production path is the manual `Migrate API D1` GitHub workflow.
It is serialized, requires the protected `production` environment and exact
confirmation input, verifies the API, lists pending migrations, and applies
them remotely.

Required production environment secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

For inspection from `services/api`:

```powershell
bunx wrangler d1 migrations list scs-portal-auth --remote
```

Do not edit an applied migration. Add the next numbered migration, test it, and
apply it through the serialized workflow.

## GitHub App Worker

The GitHub App requires minimum repository permissions for contents, branches,
pull requests, and controlled labels/comments in the data repository. Do not
grant organization-wide administration for convenience.

From `services/github-app`:

```powershell
bun run lint
bun run typecheck
bun run typecheck:test
bun run test
bun run build
bunx wrangler deploy
```

The Worker uses:

- `OPERATION_STATE` for operation records;
- `MUTATION_COORDINATOR` to serialize one logical resource;
- `OPERATION_QUEUE` for execution;
- `scs-github-operations-dlq` after three exhausted queue retries.

```mermaid
sequenceDiagram
  participant API
  participant Worker as GitHub App Worker
  participant State as Operation state
  participant Queue
  participant Executor
  participant GitHub

  API->>Worker: Submit idempotent operation
  Worker->>State: Create or reuse operation
  Worker->>Queue: Enqueue
  Queue->>Executor: Deliver attempt
  Executor->>GitHub: Compare and mutate
  alt success
    Executor->>State: Mark succeeded
  else retryable failure
    Executor->>State: Record bounded failure
    Executor-->>Queue: Retry with delay
  else permanent conflict/failure
    Executor->>State: Mark terminal outcome
  end
```

Same-resource mutations are serialized; different resources can run in
parallel. Each Durable Object persists its own SQLite data, separate from API
D1. Never edit Durable Object state manually.

## Mailer

The Mailer validates an authenticated request before passing it to SMTP. It
must have a unique `MAILER_API_KEY`, valid sender identity, and provider-specific
SMTP settings.

```powershell
bun --filter '@scs/mailer' lint
bun --filter '@scs/mailer' typecheck
bun --filter '@scs/mailer' typecheck:test
bun --filter '@scs/mailer' test
bun --filter '@scs/mailer' knip
bun --filter '@scs/mailer' check
```

Verify delivery in a non-production mailbox before enabling a new provider.
Do not log message bodies, bearer tokens, or SMTP credentials.

## Public Data Repository

This repository is deployed separately from the monorepo.

The data repository generates deterministic people, project, academic,
manifest, search, and `by-person` projections from authoritative entity files.
Its pull-request validation checks projection freshness without mutating the
branch. A serialized recovery workflow may open or refresh one automation PR
when `main` projections are stale. Deployment must use the exact commit that
passed data validation.

Repository rulesets, required checks, merge queue, auto-merge, and permission
to create automation PRs are provider settings. Verify them with a real
pull-request/merge-group run before claiming they are enforced.

## Observability

Wrangler enables invocation logs for both Workers. Structured logs should
include:

- correlation ID and operation ID;
- bounded action and resource identifiers;
- status transition and attempt number;
- duration and provider request ID where available;
- bounded error category and retry decision.

Never log tokens, cookies, private keys, raw OAuth payloads, complete private
profiles, email bodies, or full mutation payloads.

Monitor at minimum:

- Worker error and latency rates;
- authentication and rate-limit failures;
- queue backlog, retries, and dead-letter count;
- D1 migration state and database errors;
- GitHub API rate limits and repository conflicts;
- SMTP delivery failures.

## Recovery Matrix

| Failure                      | Safe response                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| app regression               | roll back only that app deployment                                                                      |
| API or GitHub App regression | roll back the affected Worker version and verify binding compatibility                                  |
| failed D1 migration          | stop deployment, preserve evidence, and add a corrective migration; do not edit applied SQL             |
| dead-lettered operation      | inspect correlation ID, attempts, and GitHub ref/PR state before replaying the original idempotency key |
| stale repository revision    | refresh the entity and submit a new mutation; do not force-push                                         |
| incorrect public data        | revert through a reviewed repository commit and regenerate projections                                  |
| exposed secret               | revoke/rotate at the provider, update stores, invalidate affected sessions/tokens, then investigate     |
| SMTP outage                  | retain authoritative application state and retry only through an explicitly idempotent delivery path    |

## Post-Deployment Verification

- Confirm the deployed commit and environment.
- Confirm the provider deployment status and exercise one representative read
  flow.
- For auth changes, test session creation, protected access, and sign-out.
- For mutation changes, test submission, polling, final outcome, and conflict.
- Check that unrelated apps/services were not redeployed unnecessarily.
- Review logs and queue state without exposing sensitive data.
- Record remaining production-only checks instead of describing them as passed.

## Provider-Side Handover Checks

These controls are intentionally outside source control and must be verified
by a maintainer with provider access:

- GitHub required checks, merge queue, protected environments, and repository
  permissions;
- Cloudflare custom domains, D1 and Durable Object bindings, queue and
  dead-letter resources, Worker build tokens, and runtime secrets;
- OAuth redirect origins and client configuration;
- Vercel project roots, build commands, environment values, and domain
  assignments for each independently deployed application or service;
- SMTP sender verification, delivery credentials, and a non-production test
  mailbox;
- deployment and validation of the separate public-data repository.

Record the verified provider, environment, deployed commit, operator, and date
in the owning operational system. Do not store secret values or temporary
handover checklists in this repository.

## Workers Builds Credential Recovery

Cloudflare's repository-connected Workers Builds uses a build token that is
separate from GitHub Actions secrets and runtime Worker secrets. If a build
reports that its selected token was deleted or rolled:

1. Open the affected Worker in Cloudflare.
2. Go to **Settings > Builds > Build Configuration**.
3. Under **API token**, create or select a current user-owned token.
4. Save the build configuration, then retry the failed build.

Do not change `CLOUDFLARE_API_TOKEN` in GitHub merely to repair this error; that
secret is used by the manually dispatched D1 migration workflow. After token
recovery, confirm the Worker build uses the workspace root directory and the
checked-in Wrangler configuration before relying on automatic deployment.

See [Security](SECURITY.md) for incident response and
[Continuous Integration](CI.md) for repository verification.
