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
wrangler secret put JWT_SECRET
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put MAILER_API_KEY
wrangler secret put GITHUB_APP_INTERNAL_SECRET
wrangler secret put CONFIG_ACCESS_TOKEN_SECRET
```

Non-secret client IDs, redirect URIs, public service URLs, and KV binding IDs
are defined in `services/api/wrangler.jsonc`.

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

## Verification Before Deployment

Run the affected workspace gate and then the root gate for shared changes:

```powershell
bun run docs:check
bun run format:check
bun run lint
bun run typecheck
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

Queue backlog, dead-letter recovery, projection regeneration, and stale PR
reconciliation procedures will be added with the durable operation runtime.

## Observability

Worker invocation logs are enabled in Wrangler configuration. Logs must carry
correlation identifiers and bounded error categories, not secrets, private
keys, tokens, full private records, or raw authentication payloads.
