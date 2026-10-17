# API Load Reduction and Instant Response Report

Date: 2026-07-28

Status: proposal for review. No API behavior is changed by this document.

This report reviews the current Cloudflare Worker API for places where portal
requests wait on GitHub, KV scans, mailer calls, or other external services.
The main direction is to keep GitHub/repository data as the source of truth and
make the API redirect, validate, or queue work instead of doing slow fanout in
the browser's request path.

## Executive Summary

The API is mostly thin orchestration, which is a good fit for Cloudflare
Workers. The slowest areas are request paths that wait on GitHub App calls,
repository reads, KV namespace scans, or external services while the portal is
waiting for a response.

Highest-impact changes:

1. Admin proxy data must remain GitHub/repo-owned. Publish
   `public/config/v1/all.json` in `config.scs.pdn.ac.lk` and serve it through a
   Worker like `data.scs.pdn.ac.lk`.
2. Change `GET /user/proxy/all` to authenticate the admin, then redirect to the
   config Worker `all.json` with a valid short-lived access token.
3. Public project reads should redirect to `data.scs.pdn.ac.lk` project JSON
   because the project data already lives in the data repo.
4. Public people reads can temporarily redirect to
   `public/people/v2/users/<username>.json` on the data Worker.
5. Keep GitHub-focused write flows for PR work, but consider returning
   `202 Accepted` for long-running GitHub automation after validation.
6. Replace remaining full KV scans where they are not GitHub-owned, especially
   passkey credential lookup.

## Source Of Truth Decisions

| Area                         | Source of truth                          | API role                                                                         | Proposed serving path                                        |
| ---------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Admin proxy config           | `config.scs.pdn.ac.lk` GitHub repository | Authenticate admin, redirect to config Worker, submit changes through GitHub App | `https://config.scs-pdn.space/config/v1/all.json`            |
| Per-user proxy config        | `config.scs.pdn.ac.lk` GitHub repository | Authenticate user/admin, call GitHub App for writes/status                       | `https://config.scs-pdn.space/config/v1/<username>.json`     |
| Public projects              | `data.scs.pdn.ac.lk` GitHub repository   | Authenticate only where portal edit UX needs it, redirect reads to data Worker   | `https://data.scs-pdn.space/projects/v2/...`                 |
| Public people profiles       | `data.scs.pdn.ac.lk` GitHub repository   | Authenticate/derive username, redirect reads to data Worker                      | `https://data.scs-pdn.space/people/v2/users/<username>.json` |
| Permissions/session/passkeys | API KV                                   | Authenticate and manage portal state                                             | API Worker                                                   |
| Magic codes                  | API KV plus mailer                       | Generate code, queue/send mail                                                   | API Worker                                                   |

Important correction: admin proxy list/build should not introduce an API KV
cache or API-owned proxy index. GitHub/config repo is the source of truth.

## Current Request Load Map

| Area                       | Endpoints                                                              | Main load source                                   | User impact                                             |
| -------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------- |
| Admin proxy overview       | `GET /user/proxy/all`, `POST /api/admin/proxy/build`                   | API lists users, then calls GitHub App per user    | Very slow and not aligned with GitHub source of truth   |
| Single proxy read/write    | `GET/POST/PATCH /user/proxy`, reset endpoints                          | GitHub App access-config and proxy-settings calls  | Correct source, but browser waits on GitHub App         |
| Public project reads       | `GET /api/projects/v2/projects`, `GET /api/projects/v2/projects/:slug` | Auth/KV check plus GitHub App fetch                | Avoidable wait because JSON already exists in data repo |
| Public people reads        | `GET /api/people/v2/me`, admin public profile reads                    | Auth/KV check plus GitHub App fetch                | Avoidable wait because user JSON exists in data repo    |
| PR submit/update           | People/project `*/pr` write endpoints                                  | Schema validation plus GitHub branch/PR automation | Browser waits for GitHub work                           |
| Admin users                | `GET /api/admin/users`                                                 | KV key listing plus batched KV gets                | Slow when permission records grow                       |
| Passkey discoverable login | `POST /auth/passkey/login/verify` without email                        | KV list plus per-user KV gets                      | Login can degrade with user count                       |
| Magic code send            | `POST /auth/magic-code`                                                | Waits for mailer API response                      | User waits on email provider latency                    |
| Profile picture update     | `PATCH /api/me`, admin user patch                                      | External `HEAD`, sometimes fallback ranged `GET`   | User waits on arbitrary image host                      |

## Proposed Fix 1 - Make `config.scs.pdn.ac.lk` A Worker-Served Config Repo

Current repo state:

- `config.scs.pdn.ac.lk` already has `public/config/v1/`.
- Current README says per-user proxy files live at
  `public/config/v1/<username>.json`.
- It does not currently have the Worker/assets setup that `data.scs.pdn.ac.lk`
  has.

Target repo shape:

```text
config.scs.pdn.ac.lk/
├── public/
│   └── config/
│       └── v1/
│           ├── all.json
│           └── <username>.json
├── src/
│   └── index.ts
└── wrangler.jsonc
```

Target Worker behavior:

- Serve static files from `public/` through a Cloudflare Worker, matching the
  `data.scs.pdn.ac.lk` asset-serving pattern.
- Add CORS for portal origins.
- For `GET /config/v1/all.json`, require a valid short-lived admin access token.
- For per-user config, choose one policy before implementation:
  - Public read if proxy URLs are considered non-sensitive.
  - Signed-token read if proxy URLs are admin/user-private.

Recommended auth design for `all.json`:

1. Portal calls API `GET /user/proxy/all`.
2. API verifies session and confirms super-admin.
3. API returns `302` or `307` to
   `https://config.scs-pdn.space/config/v1/all.json?access_token=<signed-token>`.
4. Config Worker validates the signed token and serves `all.json`.

The token should be short-lived, scoped to `proxy:all:read`, and signed with a
secret shared only by the API Worker and config Worker. Do not place permanent
secrets in the URL.

## Proposed Fix 2 - Publish `all.json` From GitHub, Not API KV

Current code:

- `listUserProxies` calls `getAllUserData(env)` and then loops through every
  user.
- For each user it calls `getUserAccessConfig`, which performs a GitHub App
  fetch.
- `buildAdminProxyManifest` repeats the same pattern.

References:

- `src/services/proxy.service.ts:421`
- `src/services/proxy.service.ts:432`
- `src/services/proxy.service.ts:436`
- `src/services/proxy.service.ts:587`
- `src/services/proxy.service.ts:595`
- `src/services/proxy.service.ts:599`
- `src/services/proxy.service.ts:91`

Why it is slow:

For `N` users, the request performs one permission-list workflow plus up to `N`
external GitHub App requests. Those GitHub App calls are awaited one by one, so
latency grows linearly.

Correct source-of-truth fix:

- GitHub App writes per-user proxy JSON files in `config.scs.pdn.ac.lk`.
- GitHub App also reconciles `public/config/v1/all.json` in the same PR/commit.
- API does not build or store a proxy aggregate in KV.
- `GET /user/proxy/all` becomes an auth gate and redirect endpoint.

Suggested `all.json` shape:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-07-28T10:00:00.000Z",
  "source": {
    "repository": "config.scs.pdn.ac.lk",
    "path": "public/config/v1/all.json"
  },
  "proxies": [
    {
      "email": "s21513@sci.pdn.ac.lk",
      "username": "s21513",
      "proxy": {
        "active": true,
        "url": "https://example.com/proxy",
        "availableAttempts": 4,
        "updatedAt": "2026-07-28T10:00:00.000Z",
        "updatedBy": "admin@sci.pdn.ac.lk"
      }
    }
  ]
}
```

API endpoint changes to propose:

- `GET /user/proxy/all`: authenticate super-admin, redirect to config Worker
  `all.json`.
- `POST /api/admin/proxy/build`: either remove it or make it trigger GitHub App
  reconciliation of `all.json`; do not generate from API KV.
- `GET /user/proxy`: continue reading the single user's repo config through the
  GitHub App until config Worker per-user auth policy is finalized.
- `POST/PATCH /user/proxy`: continue GitHub App write flow so GitHub remains the
  source of truth.

## Proposed Fix 3 - Redirect Public Project Reads To Data Worker JSON

Current code:

- Public project read endpoints call the GitHub App for aggregate and detail
  data.

References:

- `src/services/public-project.service.ts:251`
- `src/services/public-project.service.ts:280`
- `src/services/public-project.service.ts:109`

Why it is slow:

The project data already exists in `data.scs.pdn.ac.lk/public/projects/v2/`.
Calling the GitHub App for read-only public JSON adds an avoidable internal hop.

Recommended API behavior:

- `GET /api/projects/v2/projects` redirects to
  `https://data.scs-pdn.space/projects/v2/projects.json`.
- `GET /api/projects/v2/projects/:slug` redirects to
  `https://data.scs-pdn.space/projects/v2/projects/:slug.json`.
- `GET /api/projects/v2/projects/:slug/schema` remains API-owned because it is
  derived from the authenticated user's permissions.
- `GET /api/projects/v2/projects/:slug/pr` remains GitHub App backed because it
  is PR automation state.
- `POST/PUT/DELETE */pr` remain GitHub App backed.

Portal option:

The portal can skip the API entirely for project browsing and call the data
Worker directly. Keep API redirects for backward compatibility and authenticated
editor flows.

## Proposed Fix 4 - Redirect Public People Reads To User JSON Temporarily

Current code:

- Public people profile reads call the GitHub App for user profile data.

References:

- `src/services/public-profile.service.ts:418`
- `src/services/public-profile.service.ts:391`

Recommended temporary API behavior:

- `GET /api/people/v2/me`: authenticate, derive username from email, redirect
  to `https://data.scs-pdn.space/people/v2/users/<username>.json`.
- Admin profile read: authenticate super-admin, derive target username, redirect
  to the same user JSON path.
- Missing files should be handled by the portal as "profile not created yet".

Keep API-owned:

- `/schema` endpoints, because they depend on role and locked fields.
- `/pr` status and write endpoints, because they are GitHub PR automation.

This is marked temporary because a nicer final design may return a typed
`{ profile: null }` response for missing JSON while still fetching from the data
Worker internally. The immediate load reduction comes from avoiding the GitHub
App read hop.

## Proposed Fix 5 - Keep GitHub-Focused PR Writes, But Return Faster

Current code:

- People profile writes validate locally, derive paths, and wait for the GitHub
  App to create or update a pull request.
- Project writes do the same and forward `expectedHeadSha`.

References:

- `src/services/public-profile.service.ts:514`
- `src/services/public-profile.service.ts:664`
- `src/services/public-project.service.ts:320`
- `src/services/public-project.service.ts:386`

Why it is slow:

GitHub branch, file, commit, PR, and workflow operations are network-heavy. They
can take several seconds and are not ideal inside the interactive request path.

Recommended behavior after approval:

1. API validates the payload synchronously.
2. API submits a durable GitHub App job.
3. API returns `202 Accepted` with a job/status URL.
4. Portal polls PR status.

Suggested response:

```json
{
  "status": "queued",
  "jobId": "project:slug:2026-07-28T10:00:00.000Z",
  "statusUrl": "/api/projects/v2/projects/my-slug/pr/jobs/..."
}
```

Important constraint:

For project edits/deletes, the queued job must still include
`expectedHeadSha`, and the GitHub App must still return `409
project_pr_conflict` if the open PR head changed before processing.

## Proposed Fix 6 - Remaining Non-GitHub KV Scan Hotspots

These are not proxy source-of-truth issues. They are API-owned state and can use
KV indexes safely.

### Passkey Discoverable Login

Current code:

- When no email is stored in the challenge, `passkeyAuthenticationVerification`
  lists `permissions:` keys and checks each user's passkeys until it finds the
  credential ID.
- `passkeyRevoke` also scans all users when revoking by credential ID.

References:

- `src/services/passkey-auth.service.ts:535`
- `src/services/passkey-auth.service.ts:569`
- `src/services/passkey-auth.service.ts:572`
- `src/services/passkey-auth.service.ts:808`
- `src/services/passkey-auth.service.ts:848`
- `src/services/passkey-auth.service.ts:851`

Recommended fix:

Create a direct KV index:

- Key: `passkey-credential:<rpId>:<credentialId>`
- Value: lowercase email

Write this index when a passkey is registered, delete it when a passkey is
deleted, and use it during discoverable login.

### Admin Users

`GET /api/admin/users` still scans API permission KV. That is acceptable for now
if admin user counts stay small, but a future API-owned `admin-users-index` can
speed up the admin users page. This index is only for portal permission
summaries, not proxy source-of-truth data.

References:

- `src/services/admin.service.ts:52`
- `src/repositories/permissions.repo.ts:452`
- `src/repositories/permissions.repo.ts:458`
- `src/repositories/permissions.repo.ts:471`

## Proposed Fix 7 - External Service Waits

### Magic Code Send

Current code:

- The code is stored in KV.
- The request waits for `sendEmail`.

References:

- `src/services/auth.service.ts:317`
- `src/services/auth.service.ts:347`
- `src/services/auth.service.ts:352`
- `src/services/mailer.service.ts:21`

Recommended fix:

Use an async mail queue if available. The API can store the code and enqueue the
email, then return `202 Accepted` quickly.

### Manual Profile Picture Validation

Current code:

- Manual picture updates issue a `HEAD` request.
- If needed, they issue a ranged `GET`.

References:

- `src/utils/profile-picture.ts:103`
- `src/utils/profile-picture.ts:124`
- `src/services/profile.service.ts:169`
- `src/services/admin.service.ts:189`

Recommended fix:

Add a short timeout and cache successful URL validation results. If stricter UX
is needed, accept the URL as pending verification and activate it only after the
background check succeeds.

## Endpoint-Specific Recommendations

| Endpoint                                | Recommendation                                                                                 | Expected effect                                          |
| --------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `GET /user/proxy/all`                   | Authenticate super-admin, then redirect to config Worker `all.json` with a short-lived token   | Instant admin proxy list, GitHub remains source of truth |
| `POST /api/admin/proxy/build`           | Remove or change to GitHub App reconcile action for `public/config/v1/all.json`                | Removes API-side proxy rebuild                           |
| `GET /user/proxy`                       | Keep GitHub App read for now, or redirect to config Worker once per-user auth policy is chosen | Keeps source of truth in GitHub                          |
| `POST/PATCH /user/proxy`                | Keep GitHub App write flow and update per-user JSON plus `all.json`                            | GitHub-owned writes remain explicit                      |
| `GET /api/projects/v2/projects`         | Redirect to data Worker `projects/v2/projects.json`                                            | Avoids GitHub App read hop                               |
| `GET /api/projects/v2/projects/:slug`   | Redirect to data Worker detail JSON                                                            | Faster project editor open                               |
| `GET /api/people/v2/me`                 | Redirect to data Worker user JSON temporarily                                                  | Faster profile editor open                               |
| `GET /api/people/v2/admin/users/:email` | Super-admin auth, then redirect to target user JSON                                            | Faster admin profile inspection                          |
| People/project `PUT */pr`               | Keep GitHub App focused; optionally queue and return `202`                                     | Faster submit feedback                                   |
| `POST /auth/passkey/login/verify`       | Add credential ID to email KV index                                                            | Makes discoverable login stable                          |
| `POST /auth/magic-code`                 | Queue mail send                                                                                | Faster login start                                       |

## Implementation Order After Approval

1. `config.scs.pdn.ac.lk`: add Worker/assets setup matching
   `data.scs.pdn.ac.lk`, add `public/config/v1/all.json`, and document its
   schema.
2. GitHub App: update proxy write/reconcile logic so every proxy change updates
   the target user JSON and `all.json` in the config repo.
3. API: change `GET /user/proxy/all` into a super-admin auth gate that redirects
   to config Worker `all.json` with a short-lived token.
4. API: redirect public project read endpoints to data Worker JSON.
5. API: redirect public people profile read endpoints to data Worker user JSON.
6. Portal: prefer direct data/config Worker fetches where possible and keep API
   calls for auth gates, schemas, PR status, and writes.
7. API: add passkey credential index for discoverable login.
8. Optional: convert long GitHub PR writes to `202 Accepted` job flows.

## What Not To Change

- Do not make API KV the source of truth for admin proxy data.
- Do not create an API-side proxy aggregate/index.
- Do not remove project `expectedHeadSha` handling or `409
project_pr_conflict` forwarding.
- Do not bypass the GitHub App for repository writes.
- Do not expose `all.json` publicly unless proxy config is explicitly approved
  as public data.
- Do not turn GitHub App failures into generic API errors; clients need the
  upstream `message`, `error`, and `code` where available.

## Final Recommendation

Approve the config Worker and `all.json` design first. That gives admin proxy
reads an instant repository-backed path without changing the source of truth.
Then redirect public people/project reads to the existing data Worker JSON and
keep GitHub-focused write flows for PR automation.
