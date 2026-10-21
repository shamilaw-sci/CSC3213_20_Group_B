# Operations

## Deployment Units

Each application and service deploys independently. Root commands verify the
repository; they do not deploy every workspace together.

| Unit                   | Runtime            | Build or deploy entry        |
| ---------------------- | ------------------ | ---------------------------- |
| Four apps              | Next.js            | workspace `build`            |
| `@scs/api`             | Cloudflare Workers | workspace `deploy`           |
| `@scs/github-app`      | Worker or Bun      | Wrangler build or Bun start  |
| `@scs/mailer`          | Bun/Hono           | workspace `start`            |
| Public data repository | Cloudflare assets  | separate repository workflow |
| Config repository      | Cloudflare assets  | separate repository workflow |

Docker is not part of the current build, test, or deployment process.

## Required Secrets

Values previously committed anywhere must be considered compromised and
rotated. Never copy usable values into source, examples, logs, documentation,
issues, or pull-request bodies.

### API Worker

Configure from `services/api`:

```powershell
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put MAILER_API_KEY
wrangler secret put GITHUB_APP_INTERNAL_SECRET
wrangler secret put CONFIG_ACCESS_TOKEN_SECRET
```

Non-secret client IDs, public service URLs, the config-token issuer, and
resource binding IDs are defined in `services/api/wrangler.jsonc`.

### One-Time Authentication Migration

After applying the D1 migrations and deploying the Better Auth-only API, a
super-admin can run the `migrate-legacy-auth` action from the Portal admin
actions interface. The action requires the displayed confirmation phrase,
uses deterministic identifiers and conflict-safe inserts, and can be retried.
It copies GitHub identities and passkeys into D1, removes migrated auth fields
from permission records, and reports conflicts without cleaning their source
records. Review every conflict before retrying, then remove the action after
production migration is confirmed.

### D1 and Proxy Settings Migration

Run the manual `Migrate API D1` workflow with its exact confirmation phrase.
The workflow is serialized, uses the protected `production` environment,
verifies the API workspace, shows pending migrations, and then applies them to
`scs-portal-auth`. Configure `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` as production environment secrets.

After migration `0003_proxy_settings.sql` is applied and the API containing the
new table is deployed, a super-admin runs `migrate-proxy-settings` from the
Portal admin actions interface using this confirmation phrase:

```text
Migrate legacy proxy settings into D1.
```

The action imports the signed legacy aggregate with conflict-safe inserts and
does not overwrite a D1 row. Review the reported counts and conflicts, verify
Portal proxy reads, edits, pagination, and admin resets, and only then remove
the migration action and its three config-source variables. Normal proxy
traffic never reads the legacy aggregate or calls the GitHub App.

### GitHub App

Configure from `services/github-app`:

```powershell
wrangler secret put GITHUB_PRIVATE_KEY
wrangler secret put X_INTERNAL_SECRET
```

The GitHub App ID, installation ID, owner, and repository names are non-secret
bindings. Store no PEM file in the repository.

### Mailer

Configure `MAILER_API_KEY`, SMTP host, port, secure mode, username, password,
and sender identity in the deployment secret store. The mailer refuses to
start without its API key.

## Local Configuration

Use ignored `.env` or `.dev.vars` files copied from workspace examples. Verify
that the Portal cookie domain covers both the site and API hosts in the target
environment.

## GitHub App Permissions

The installation needs only repository permissions required to read contents,
create/update branches and pull requests, add controlled labels/comments, and
update configured repository permissions. Re-evaluate permissions when a
feature changes; do not grant organization-wide administration for
convenience.

## Durable GitHub Mutations

The GitHub App stores operation state in the `OPERATION_STATE` Durable Object
binding and serializes each logical resource through the
`MUTATION_COORDINATOR` binding. Accepted production work is published to the
`OPERATION_QUEUE` queue; messages that exhaust three queue retries move to
`scs-github-operations-dlq` for explicit recovery.

Operation IDs are deterministic for an actor and idempotency key. A separate
hash covers the actor, action, resource, and validated payload, so reusing a
key for different input is rejected. The executor records `queued`, `running`,
and terminal transitions around external GitHub calls. It serializes the same
resource while allowing independent resources to proceed concurrently, never
logs request payloads, and applies bounded provider-aware retry delays.

Trusted upstream requests can inspect or cancel an operation through:

```text
GET /operations/:operationId
DELETE /operations/:operationId
```

Both routes require `X-Actor-Subject-Id`. The subject must match the operation
owner unless `X-Actor-Admin: true` is supplied by the authenticated upstream
API. Cancellation is immediate while queued. Once external work is running,
the cancellation request is persisted and prevents another retry; a side
effect that has already completed is reported truthfully as completed.

## Verification Before Deployment

Run the affected workspace gate and then the root gate for shared changes:

```powershell
bun run docs:check
bun run format:check
bun run lint
bun run typecheck
bun run typecheck:test
bun run test
bun run build
```

Credential-dependent external integrations require a dedicated test
environment. A mocked suite or Wrangler build does not prove live GitHub, SMTP,
OAuth, KV, queue, or repository-ruleset behavior.

## Recovery

- API or GitHub App: roll back the independently deployed Worker version.
- Portal or public app: roll back that app deployment without redeploying
  services.
- Git-backed data: revert the publishing commit through a reviewed change; do
  not rewrite shared history.
- Secret exposure: rotate at the provider, update the deployment store, and
  invalidate affected sessions or keys.
- Failed automation: preserve the operation/PR audit trail, determine whether a
  side effect occurred, and retry only through an idempotent path.
- Dead-lettered operation: inspect its correlation ID, attempt count, and
  bounded error category; verify the GitHub ref/PR state before replaying the
  original idempotency key. Never edit Durable Object state by hand.

The public-data repository generates deterministic v2 collection, search,
manifest, student, staff, academic, project, and `by-person` projections. Run
`bun run generate` after an entity change and `bun run generate:check` before
publication. CI checks projections without modifying pull-request branches.
A serialized recovery workflow opens or refreshes the single
`automation/public-projections` pull request when `main` is stale. Deployment
uses the exact successful `Validate Public Data` commit. Run `39565486965`
successfully deployed data commit `12966fb`, so the polling schedule was
removed; manual dispatch remains the recovery path.

The data and config rulesets must require their validation workflows for pull
requests and merge groups. Auto-merge and GitHub Actions pull-request creation
must be enabled for projection recovery. These settings and the event-driven
deployment path are operator-controlled and must not be reported as verified
until real remote runs succeed. Queue backlog and dead-letter counts must be
monitored before and after GitHub App releases.

## Observability

Worker invocation logs are enabled in Wrangler configuration. Logs must carry
correlation identifiers and bounded error categories, not secrets, private
keys, tokens, full private records, or raw authentication payloads.
