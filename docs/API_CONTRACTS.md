# API Contracts

This document is the human-readable HTTP reference. The route tables in
`services/api/src/routes/index.ts` and `services/github-app/src/app.ts`, plus
the schemas exported by `@scs/schemas`, remain the executable source of truth.

## Service Boundaries

| Service               | Audience                            | Authentication                                |
| --------------------- | ----------------------------------- | --------------------------------------------- |
| `services/api`        | Portal and approved browser clients | Better Auth session plus authorization checks |
| `services/github-app` | API Worker only                     | `X-Internal-Secret`                           |
| `services/mailer`     | trusted services only               | bearer `MAILER_API_KEY`                       |

The browser-facing API uses the `/api` namespace. The GitHub App and Mailer
routes are internal and must not be called directly from browser code.

## Common Browser API Rules

- Send session cookies with protected requests.
- Send `X-Client-Id: portal` where client validation is required.
- Send JSON bodies with `Content-Type: application/json`.
- Treat cursor and operation identifiers as opaque strings.
- Do not parse human-readable error messages for program logic.
- Validate responses with the matching schema when crossing a trust boundary.

Common status meanings:

| Status | Meaning                                                 |
| ------ | ------------------------------------------------------- |
| `200`  | request completed synchronously                         |
| `202`  | durable mutation accepted; poll the operation URL       |
| `400`  | malformed input, invalid cursor, or unsupported payload |
| `401`  | missing or invalid authentication                       |
| `403`  | authenticated but not authorized                        |
| `404`  | route or resource does not exist                        |
| `405`  | route exists but does not support the method            |
| `409`  | revision, idempotency, or state conflict                |
| `429`  | request was rate-limited                                |
| `502`  | an upstream service failed or returned invalid data     |

## Versioned Errors

New contracts use `ApiErrorEnvelopeSchema` from `@scs/schemas`:

```json
{
  "version": 1,
  "error": {
    "code": "entity_revision_conflict",
    "message": "The project changed after it was loaded.",
    "correlationId": "req_01JAA2V8M7X4G9NK2QF6D3P1ZT",
    "conflict": {
      "resourceType": "project",
      "resourceId": "example-project",
      "expectedRevision": "blob-41",
      "actualRevision": "blob-42"
    }
  }
}
```

`code` is stable and machine-readable. `message` is bounded prose for people.
`correlationId` connects the response to structured logs. Conflict details may
contain resource identity and revisions, but never credentials or provider
payloads.

## Pagination

Page routes accept `limit` and optional `cursor` query parameters. The default
limit is 25 and the maximum is 100. A cursor is scoped to one route and cannot
be reused with another collection.

```json
{
  "version": 1,
  "items": [],
  "page": {
    "nextCursor": null,
    "hasMore": false,
    "total": 0
  }
}
```

Clients must follow `nextCursor` rather than constructing cursors or assuming
offset pagination. `total` is optional and must not be required by a generic
pagination component.

## Durable Mutations

Portal sends `Prefer: respond-async` for profile, project, course, and offering
changes. The request body includes `MutationControl`:

```json
{
  "idempotencyKey": "01JAA2V8M7X4G9NK2QF6D3P1ZT",
  "expectedRevision": "blob-42"
}
```

Use `missing` as the expected revision for a new entity. The same logical user
action must reuse its idempotency key when retried. Reusing a key for different
input returns a conflict.

A successful submission returns `MutationAcceptedSchema` with `202 Accepted`:

```json
{
  "version": 1,
  "operationId": "op_01JAA2V8M7X4G9NK2QF6D3P1ZT",
  "status": "queued",
  "statusUrl": "/api/operations/op_01JAA2V8M7X4G9NK2QF6D3P1ZT",
  "retryAfterMs": 1000
}
```

```mermaid
stateDiagram-v2
  [*] --> queued
  queued --> running
  queued --> cancelled
  running --> succeeded
  running --> conflicted
  running --> failed
  running --> queued: retryable failure
```

Read or request cancellation of the caller's operation with:

| Method   | Route                          |
| -------- | ------------------------------ |
| `GET`    | `/api/operations/:operationId` |
| `DELETE` | `/api/operations/:operationId` |

The API owns actor authorization. Emails, provider tokens, and private request
bodies are not exposed in operation resources.

## Authentication and Current Account

Better Auth is mounted at `/api/auth/*` and owns email OTP, Google, GitHub,
passkey, account-linking, session, and sign-out endpoints. Email/password auth
and parallel custom JWT/WebAuthn routes are not enabled.

| Method  | Route                   | Purpose                                            |
| ------- | ----------------------- | -------------------------------------------------- |
| `GET`   | `/api/me`               | read the current account and permission projection |
| `PATCH` | `/api/me`               | update allowed current-account fields              |
| `PATCH` | `/api/me/notifications` | update notification preferences                    |

Session validation alone is not authorization. Protected requests also check
the current permission record so blacklisting and role changes take effect.

## Public Profile Management

| Method                 | Route                                       | Purpose                                 |
| ---------------------- | ------------------------------------------- | --------------------------------------- |
| `GET`                  | `/api/people/v2/me`                         | read the current user's public profile  |
| `GET`                  | `/api/people/v2/me/schema`                  | read editable profile schema metadata   |
| `GET`                  | `/api/people/v2/me/pr`                      | read current profile pull-request state |
| `POST`, `PUT`          | `/api/people/v2/me/pr`                      | create or update a profile mutation     |
| `POST`                 | `/api/people/v2/me/student-placement`       | submit placement metadata               |
| `GET`                  | `/api/people/v2/admin/student-placement`    | read placement source data              |
| `GET`, `PUT`, `DELETE` | `/api/people/v2/admin/student-placement/pr` | manage the placement pull request       |
| varies                 | `/api/people/v2/admin/users/:identity/...`  | manage another user's public profile    |

Admin profile suffixes include `/schema`, `/pr`, and `/student-placement`.
Unknown suffixes are rejected rather than interpreted as repository paths.

## Projects and Academics

| Methods                        | Route                                    | Purpose                           |
| ------------------------------ | ---------------------------------------- | --------------------------------- |
| `GET`                          | `/api/projects/v2/projects/page`         | list a bounded project page       |
| `GET`                          | `/api/projects/v2/projects/:slug`        | read one project                  |
| `GET`                          | `/api/projects/v2/projects/:slug/schema` | read project schema metadata      |
| `GET`, `POST`, `PUT`, `DELETE` | `/api/projects/v2/projects/:slug/pr`     | manage a project mutation         |
| `GET`                          | `/api/academic/v2/courses`               | read the course reference array   |
| `GET`                          | `/api/academic/v2/courses/page`          | list a bounded course page        |
| `GET`                          | `/api/academic/v2/courses/:id`           | read one course                   |
| `GET`                          | `/api/academic/v2/courses/:id/schema`    | read course schema metadata       |
| `GET`, `PUT`, `DELETE`         | `/api/academic/v2/courses/:id/pr`        | manage a course mutation          |
| `GET`                          | `/api/academic/v2/offerings`             | read the offering reference array |
| `GET`                          | `/api/academic/v2/offerings/page`        | list a bounded offering page      |
| `GET`                          | `/api/academic/v2/offerings/:id`         | read one offering                 |
| `GET`, `PUT`, `DELETE`         | `/api/academic/v2/offerings/:id/pr`      | manage an offering mutation       |

The unbounded project collection route is intentionally unavailable. Course
and offering arrays remain because Portal editors currently use them as
reference data; new collection UIs should use page routes.

## Administration and Proxy Settings

| Method                   | Route                               | Purpose                                        |
| ------------------------ | ----------------------------------- | ---------------------------------------------- |
| `GET`                    | `/api/admin/users/page`             | list a bounded page of users                   |
| `GET`, `PATCH`, `DELETE` | `/api/admin/users/:email`           | manage one permission record                   |
| `GET`                    | `/api/admin/proxies/page`           | list proxy settings from D1                    |
| `POST`                   | `/api/admin/proxies/reset-attempts` | reset one user's edit attempts                 |
| `GET`, `POST`            | `/api/me/proxy`                     | read or edit the current user's proxy settings |

These routes require a non-blacklisted super-admin except `/api/me/proxy`.
Users cannot reset their own attempt counter. Proxy edits use one atomic D1
statement to enforce the attempt limit.

## Internal GitHub App API

Every route requires `X-Internal-Secret`. Operation reads also require
`X-Actor-Subject-Id`; trusted admin reads set `X-Actor-Admin: true`.

| Route group                    | Responsibility                                         |
| ------------------------------ | ------------------------------------------------------ |
| `/operations/:operationId`     | read or request cancellation of durable work           |
| `/people/public-profile*`      | read profile state and manage profile PRs/operations   |
| `/people/student-placement/pr` | manage placement metadata PRs                          |
| `/projects/public-project*`    | read project state and manage project PRs/operations   |
| `/academic/public-course*`     | read academic state and manage academic PRs/operations |

The `POST .../operations` routes are the durable mutation entry points. Some
synchronous PR routes remain compatibility adapters for trusted callers. Do not
remove them without production caller evidence and a coordinated contract
change.

## Mailer API

`POST /send` requires `Authorization: Bearer <MAILER_API_KEY>` and JSON:

```json
{
  "to": ["user@pdn.ac.lk"],
  "subject": "Sign in to SCS Portal",
  "html": "<p>Optional HTML body</p>",
  "text": "Optional plain-text body"
}
```

`to` contains 1–50 valid addresses, `subject` is required, and at least one of
`html` or `text` is required. Success returns `{ "ok": true }`; validation,
authentication, and upstream SMTP failures return `400`, `401`, and `502`.

## Changing a Contract

1. Find every producer and consumer, including tests and separate repositories.
2. Change or add the `@scs/schemas` contract first when it is shared.
3. Prefer additive versioned changes over silently changing existing meaning.
4. Add boundary tests for success, invalid input, authorization, conflict, and
   retry behavior.
5. Update Portal/API/GitHub App clients together when the contract spans them.
6. Update this document, [Schemas](SCHEMAS.md), and
   [Operations](OPERATIONS.md) when applicable.
