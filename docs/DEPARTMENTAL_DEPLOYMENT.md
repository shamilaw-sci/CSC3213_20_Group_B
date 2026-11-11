---
title: Departmental deployment
description: Docker Compose installation and operations for the self-hosted profile.
---

# Departmental deployment

This profile runs one copy of the existing API, GitHub App, Mailer, Portal,
People, Projects, Web, and Docs applications behind Caddy. PostgreSQL stores
auth, permissions, avatar review state, operations, and pg-boss jobs. SeaweedFS
stores private avatar objects through the existing S3 adapter. Caddy serves a
reviewed snapshot of the separate public-data repository's `public/` tree.
GitHub remains the authoritative source for public data; this profile does not
automatically publish GitHub commits to the snapshot.

## Requirements and boundaries

- A Linux host with Docker Engine and Docker Compose v2, durable disks for
  PostgreSQL and SeaweedFS, backup storage on a different failure domain, and
  enough RAM and CPU to build five Next.js applications. Allow at least 40 GB
  of free space for images and build cache in addition to database and object
  data. Choose an unused
  `172.30.<APP_NETWORK_OCTET>.0/24` application network. Use a different
  octet for an isolated restore drill on the same host.
- DNS A/AAAA records for the root domain and `api`, `portal`, `people`,
  `projects`, `docs`, and `data` subdomains, all pointing to the Caddy host.
  Expose only TCP 80/443 and UDP 443. Caddy obtains and renews TLS
  certificates; keep its named volumes across updates.
- A GitHub App installation and OAuth applications, Google OAuth, a TypeSafe
  moderation key, and an SMTP relay. Register the public API OAuth callback
  URLs under `https://api.<domain>/api/auth/callback/{github,google}` and the
  Portal origin. Set passkey RP ID to the Portal hostname. The Bun API derives
  these from `SITE_DOMAIN`; check provider dashboards before cutover.
- A separately reviewed public-data repository checkout. Validate the exact
  Git commit with that repository's CI and copy only its `public/` directory
  into `PUBLIC_DATA_DIR`. The Caddy static host is read only; it never receives
  GitHub App secrets or private avatar objects.

No production database or bucket is changed by copying configuration. D1,
Durable Objects, Cloudflare Queues, and R2 data require separate migration and
cutover procedures. See [database portability](DATABASE_PORTABILITY.md),
[durable operations](SERVICES/GITHUB_APP/DURABLE_OPERATIONS.md), and
[storage](STORAGE.md). Live public-data updates still require an operator to
promote a validated GitHub revision to the snapshot.

## Install and configure

From this repository's root on the deployment host:

```sh
cp deploy/self-hosted/.env.example deploy/self-hosted/.env
chmod 600 deploy/self-hosted/.env
mkdir -p /srv/scs/public-data
```

Set every placeholder in `.env`. Use independent random passwords for the
PostgreSQL administrator, migration, API, and worker roles; URL-encode passwords
in the three connection URLs. The bootstrap script creates those roles and
the `scs_api`, `scs_operations`, and `scs_jobs` schemas on a **new** PostgreSQL
volume. It does not rerun on an existing volume. Runtime roles have data access
only; the migration role owns the schemas and has database `CREATE` permission
for pg-boss's official migration CLI. Runtime roles cannot edit the application
migration journals. PostgreSQL and SeaweedFS have no
published host ports. Never commit `.env`, dump files, or private keys. Protect
the Docker host and Compose environment because container administrators can
read process environment variables.

Set `GITHUB_PRIVATE_KEY` to the PEM with literal `\n` between lines. Use the
same `GITHUB_APP_INTERNAL_SECRET` in the API and GitHub App, and the same
`MAILER_API_KEY` in the API and Mailer. `WEB_PROXY_INTERNAL_SECRET` is shared
only by Web and API. The avatar bucket is `scs-avatars`; SeaweedFS creates it
from `S3_BUCKET` at initial startup. Test conditional create and replace with
the storage integration suite before importing real avatars. Keep the bucket
private; all avatar access goes through the API.

Prepare the public-data snapshot first. For a new domain, start Caddy alone
with `docker compose ... up -d --no-deps proxy` so `data.<domain>` is reachable
while building Next.js pages. The operator must copy a validated public-data
`public/` tree into `PUBLIC_DATA_DIR` before this step. If the existing
Cloudflare data host is still serving the same domain during migration, keep
that host active until the replacement snapshot is verified.

In the commands below, `dc` abbreviates
`docker compose --env-file deploy/self-hosted/.env -f deploy/self-hosted/compose.yaml`.
Use the full command in shells where aliases or functions are unavailable.

In PowerShell, use `function dc { docker compose --env-file
deploy/self-hosted/.env -f deploy/self-hosted/compose.yaml @args }`. In an
interactive CMD window, use `doskey dc=docker compose --env-file
deploy/self-hosted/.env -f deploy/self-hosted/compose.yaml $*`. The `dc`
examples below then work in those shells too.

```sh
dc() { docker compose --env-file deploy/self-hosted/.env -f deploy/self-hosted/compose.yaml "$@"; }
dc up -d postgres storage
dc build migrate
dc run --rm migrate
dc build api github-app mailer portal people projects web docs
dc up -d
dc ps
```

The migration command uses a PostgreSQL session advisory lock, verifies
checksums of the reviewed SQL, and runs pg-boss's official migration CLI. It
rejects untracked pre-existing tables. Run it once per deployment before
starting services and again for reviewed updates. Neither Bun service changes
schema on startup. Review `pg-boss plans migrate --dry-run` and SQL changes,
back up first, and run only one deployment process at a time. The GitHub App
marks `/readyz` healthy only after pg-boss, its queues, worker, and outbox
recovery start. The API waits for its database, bucket, GitHub App, and Mailer.

## Smoke test in isolated staging

Use a staging domain, separate OAuth and GitHub App installations, test SMTP,
test TypeSafe credentials, and disposable PostgreSQL/storage volumes. First
run the uncached PostgreSQL tests with `POSTGRES_TEST_URL` pointing to a
disposable PostgreSQL 17 database and the S3 contract test with `S3_TEST_*`
pointing to a disposable private bucket; set `S3_TEST_ALLOW_WRITES=1` only for
that bucket. Then verify through HTTPS:

1. Fetch `data.<domain>/people/v2/...json` and each public site. Check TLS,
   redirects, API `/healthz` and `/readyz`, and that the GitHub App, Mailer,
   PostgreSQL, and S3 ports are not publicly reachable.
2. Sign in through OAuth and OTP, restart API, and confirm the same session
   remains valid. Check passkey registration and sign-in with the configured
   Portal RP ID. Check ordinary and admin permissions and rate limits from
   two distinct client IPs through Caddy. A direct non-Caddy connection to
   the API must be rejected.
3. Upload a WebP candidate and a PNG/JPEG requiring Sharp processing. Check
   approved public access, private pending-review access, admin review,
   rejection and approval transitions, immutable object keys, and pointer
   conditional writes. Confirm the bucket itself exposes no public URL.
4. Submit an idempotent GitHub operation through the API, confirm the worker
   processes it, restart the worker and verify outbox recovery. Induce a
   retryable failure and a dead-letter case in staging; inspect and redrive
   only after identifying the cause. Confirm GitHub revision conflicts remain
   visible and do not overwrite newer content.
5. Stop and restart API, GitHub App, PostgreSQL, and storage separately. Check
   retained sessions, operations, queue jobs, and avatar bytes. On Linux,
   send `SIGTERM` with Compose and confirm listener drain, PostgreSQL pool
   closure, worker stop, and pg-boss termination in logs. A Windows child
   process exit alone does not establish graceful shutdown.

The repository's Bun integration tests mock only TypeSafe classification and
external GitHub/OAuth/SMTP providers where explicitly noted in their tests.
Live provider callbacks, mail delivery, production DNS/TLS, and end-to-end
GitHub repository mutation require the staging credentials above. Do not
claim a production cutover until these checks and a backup/restore drill pass.

## Back up and restore

Freeze writes by stopping API and GitHub App before a coordinated snapshot.
Take a custom-format PostgreSQL dump with `pg_dump -Fc` and copy it off-host.
Stop SeaweedFS and archive the `scs-pdn_storage_data` volume while it is idle.
Record the image digests, SQL migration checksums, public-data commit SHA, and
the Caddy configuration. Encrypt backups and test restoration into a **new**
Compose project and empty volumes before relying on them. Include the Caddy
volumes if preserving certificate state matters; they can also be renewed.

Run the following from the repository root after creating a protected
`backups` directory. In Bash/Zsh/Git Bash, `$(dc ps -q postgres)` expands the
container ID. In PowerShell it also expands; in CMD, run `dc ps -q postgres`
first and substitute the printed ID manually.

```sh
dc stop api github-app
dc exec -T postgres pg_dump -U scs_admin -d scs -Fc -f /tmp/scs.dump
docker cp "$(dc ps -q postgres):/tmp/scs.dump" backups/scs.dump
dc stop storage
docker run --rm --entrypoint tar -v scs-pdn_storage_data:/data:ro -v "$PWD/backups:/backup" chrislusf/seaweedfs:4.53 -czf /backup/storage.tar.gz -C /data .
```

The fixed `scs-pdn_storage_data` volume name is for the default Compose
project. Use the actual project volume name in staging. On Windows, replace
`$PWD/backups` with an absolute path accepted by Docker Desktop. Resume
services only after both backup files have been copied to protected off-host
storage and their checksums recorded.

For a database restore, create the roles from `postgres-init.sh` on the new
volume, then use `pg_restore --clean --if-exists --no-owner --role=scs_migrator`
as the database administrator. Restore the SeaweedFS volume before starting
storage. Restore the exact public-data snapshot separately. Verify row counts,
session reads, pending reviews, outbox rows, queue jobs, and object hashes; run
the S3 conditional-write tests against a **disposable** bucket. Do not restore
over a running production volume. Roll back an application upgrade by restoring
the coordinated pre-upgrade DB and object snapshot with the previous image
digests and public-data commit. Reversing SQL alone does not reverse writes.
The restoration commands for a **new, empty** project are:

```sh
dc up -d --wait postgres
docker cp backups/scs.dump "$(dc ps -q postgres):/tmp/scs.dump"
dc exec -T postgres pg_restore -U scs_admin -d scs --clean --if-exists --no-owner --role=scs_migrator /tmp/scs.dump
dc create --no-deps storage
docker run --rm --entrypoint tar -v scs-pdn_storage_data:/data -v "$PWD/backups:/backup:ro" chrislusf/seaweedfs:4.53 -xzf /backup/storage.tar.gz -C /data
dc up -d storage
```

Check grants and migration checksums before starting the runtime. Restore
`PUBLIC_DATA_DIR` from its recorded Git commit, then run the staging smoke
tests before changing DNS or accepting writes.

## Monitoring and updates

Use `dc ps` and `dc logs --tail=200 api github-app mailer postgres storage proxy`
for health and errors. Alert on unhealthy services, PostgreSQL disk and
connections, storage disk, TLS renewal, SMTP failures, queue backlog and
dead-letter jobs. In PostgreSQL, monitor pending outbox rows with
`SELECT count(*), min(created_at) FROM scs_operations.operation_dispatch_outbox WHERE dispatched_at IS NULL`.
Use pg-boss's CLI `doctor` and its documented queue inspection/redrive tools;
review the operation state and GitHub revision before redrive. Preserve direct
database sessions for the GitHub App's session advisory locks; transaction
pooling breaks those locks. If the database connection disappears during a
GitHub mutation, the runtime aborts rather than silently continuing, while
GitHub revision checks remain the final conflict guard.

For an update, pin reviewed image versions, snapshot all data, review migration
plans, run `dc run --rm migrate`, rebuild the affected images, then use
`dc up -d --no-deps <service>` in dependency order. Rebuild Next.js images
whenever `SITE_DOMAIN` or any `NEXT_PUBLIC_*` value changes; these values are
compiled into the client bundles. Promote a validated public-data commit by
replacing the read-only snapshot during a short proxy maintenance window.
Changing `AVATAR_S3_ENDPOINT` or `POSTGRES_URL` never copies records or objects.

## Known limits

This Compose profile uses one host, one PostgreSQL instance, and SeaweedFS
`weed mini`. It has no automatic failover. Backups and a rehearsed restore are
required; a failed host causes downtime. The validated public-data snapshot is
promoted manually from GitHub. SeaweedFS 4.53 passed the conditional S3 write
contract; re-run that test before any storage upgrade. The Docker Desktop
loopback test verifies header overwrite but cannot establish preservation of
distinct public client IPs through Linux host networking. Test that on the
department's staging host. External OAuth, passkeys, SMTP, TypeSafe, GitHub
mutations, public ACME certificate issuance, and a full D1/R2 cutover require
staging credentials and a separate operator sign-off.
