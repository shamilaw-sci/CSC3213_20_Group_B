# Environment Variables

This is the canonical discovery page for runtime configuration. Each
deployable keeps its own example file because applications and services remain
independently deployable. Typed config modules are the validation source of
truth; example files are safe templates and never contain working secrets.

## Workspace Map

| Workspace  | Local template                     | Validation source                                  | Deployment configuration                                 |
| ---------- | ---------------------------------- | -------------------------------------------------- | -------------------------------------------------------- |
| Web        | `apps/web/.env.example`            | `apps/web/src/config/*.env.config.ts`              | hosting environment                                      |
| People     | `apps/people/.env.example`         | `apps/people/src/config/public.env.config.ts`      | hosting environment                                      |
| Projects   | `apps/projects/.env.example`       | `apps/projects/src/config/public.env.config.ts`    | hosting environment                                      |
| Portal     | `apps/portal/.env.example`         | `apps/portal/src/config/*.env.config.ts`           | hosting environment                                      |
| API        | `services/api/.dev.vars.example`   | `services/api/src/types/env.ts`                    | `services/api/wrangler.jsonc` plus Worker secrets        |
| GitHub App | `services/github-app/.env.example` | `services/github-app/src/config/runtime.config.ts` | `services/github-app/wrangler.jsonc` plus Worker secrets |
| Mailer     | `services/mailer/.env.example`     | `services/mailer/src/config/env.ts`                | hosting environment                                      |

Next applications use `@t3-oss/env-nextjs`. Bun entrypoints use
`@t3-oss/env-core`. Cloudflare Worker bindings are request-scoped and typed
instead of being copied into `process.env`.

## Web

| Variable               | Visibility | Default or requirement               |
| ---------------------- | ---------- | ------------------------------------ |
| `NEXT_PUBLIC_SITE_URL` | public     | `https://scs.pdn.ac.lk`              |
| `BASE_DOMAIN`          | server     | `scs.pdn.ac.lk`                      |
| `MOODLE_URL`           | server     | `https://scilms.pdn.ac.lk`           |
| `WORKER_URL`           | server     | SCS proxy Worker URL                 |
| `CF_SECRET`            | secret     | internal proxy authentication secret |

## People

| Variable                             | Visibility | Default or requirement    |
| ------------------------------------ | ---------- | ------------------------- |
| `NEXT_PUBLIC_SITE_URL`               | public     | People site URL           |
| `NEXT_PUBLIC_PEOPLE_DATA_BASE_URL`   | public     | people v2 data base URL   |
| `NEXT_PUBLIC_PROJECTS_DATA_BASE_URL` | public     | projects v2 data base URL |
| `NEXT_PUBLIC_PROJECTS_SITE_URL`      | public     | Projects site URL         |

## Projects

| Variable                             | Visibility | Default or requirement                                        |
| ------------------------------------ | ---------- | ------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`               | public     | Projects site URL                                             |
| `NEXT_PUBLIC_PROJECTS_DATA_BASE_URL` | public     | projects v2 data base URL, or `local` for the bundled fixture |
| `NEXT_PUBLIC_PEOPLE_SITE_URL`        | public     | People site URL                                               |

## Portal

| Variable                                   | Visibility | Default or requirement                  |
| ------------------------------------------ | ---------- | --------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                     | public     | Portal site URL                         |
| `NEXT_PUBLIC_BASE_API_URL`                 | public     | API base URL                            |
| `NEXT_PUBLIC_PEOPLE_DATA_BASE_URL`         | public     | people v2 data base URL                 |
| `NEXT_PUBLIC_VERIFICATION_CODE_MAX_LENGTH` | public     | positive integer, default `6`           |
| `NEXT_PUBLIC_DEFAULT_AVAILABLE_ATTEMPTS`   | public     | non-negative integer, default `5`       |
| `NEXT_PUBLIC_API_CLIENT_ID`                | public     | API client identifier, default `portal` |
| `COOKIE_DOMAIN`                            | server     | shared authentication cookie domain     |

The three formerly unprefixed browser values now use `NEXT_PUBLIC_` so Next.js
can safely and predictably include them in client bundles.

## API Worker

Non-secret string variables live in `services/api/wrangler.jsonc`:
`BETTER_AUTH_URL`, `CONFIG_ACCESS_TOKEN_ISSUER`, OAuth client IDs,
`MAILER_API_URL`, `GITHUB_APP_API_URL`, `CONFIG_DATA_BASE_URL`, and
`DATA_PUBLIC_BASE_URL`.

Secrets copied from `services/api/.dev.vars.example` are `BETTER_AUTH_SECRET`,
`GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_SECRET`, `MAILER_API_KEY`,
`GITHUB_APP_INTERNAL_SECRET`, and `CONFIG_ACCESS_TOKEN_SECRET`. Configure them
as Worker secrets outside local development.

Resource bindings are not environment strings:

- `AUTH_DB` is the D1 source of truth for Better Auth users, accounts,
  sessions, verification records, rate limits, and passkeys. Its provisioned
  database ID is configured in `services/api/wrangler.jsonc`; apply
  `services/api/migrations/` with Wrangler before deployment.
- `PERMISSIONS` is the KV namespace for application authorization and profile
  preferences. It does not store sessions, verification codes, OAuth account
  state, or passkeys.
- `GITHUB_APP` is the preferred service binding to the GitHub App Worker.
- `GITHUB_APP_API_URL` remains the independently deployable HTTP fallback.

## GitHub App

| Variable                          | Kind              | Requirement                                  |
| --------------------------------- | ----------------- | -------------------------------------------- |
| `GITHUB_APP_ID`                   | configuration     | required                                     |
| `GITHUB_PRIVATE_KEY`              | secret            | required; escaped newlines are normalized    |
| `GITHUB_INSTALLATION_ID`          | configuration     | required                                     |
| `GITHUB_OWNER`                    | configuration     | required                                     |
| `GITHUB_CONFIG_REPOSITORY`        | configuration     | required                                     |
| `GITHUB_PEOPLE_DATA_REPOSITORY`   | configuration     | required                                     |
| `GITHUB_PROJECTS_DATA_REPOSITORY` | configuration     | required                                     |
| `X_INTERNAL_SECRET`               | secret            | required; must match the API internal secret |
| `PORT`                            | local Bun adapter | integer from 1 to 65535, default `3000`      |

The Cloudflare adapter validates bindings per request. The Bun adapter reads
the same contract through T3 Env. Neither adapter logs secret values.

## Mailer

| Variable                       | Kind               | Default or requirement                 |
| ------------------------------ | ------------------ | -------------------------------------- |
| `MAILER_API_KEY`               | secret             | required                               |
| `SMTP_HOST`                    | configuration      | `smtp.example.com`                     |
| `SMTP_PORT`                    | configuration      | `587`                                  |
| `SMTP_SECURE`                  | configuration      | `false`                                |
| `SMTP_USER`                    | secret             | empty by default                       |
| `SMTP_PASS`                    | secret             | empty by default                       |
| `SMTP_FROM`                    | configuration      | falls back to `SMTP_USER`              |
| `PORT`                         | local Bun adapter  | `3000`                                 |
| `VERCEL_EXPERIMENTAL_BACKENDS` | deployment adapter | optional; not read by application code |

## Local Setup

Copy only the template for the workspace being run. Never commit populated
`.env`, `.env.local`, or `.dev.vars` files.

```powershell
Copy-Item apps/portal/.env.example apps/portal/.env.local
Copy-Item services/api/.dev.vars.example services/api/.dev.vars
Copy-Item services/github-app/.env.example services/github-app/.env
```

When adding or renaming a variable, update the typed config, its workspace
template, and this catalog in the same commit. Secrets belong in the hosting
provider or `wrangler secret`; non-secrets belong in the workspace deployment
configuration.
