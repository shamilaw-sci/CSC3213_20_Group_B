# API Contracts

## Scope

The public API is implemented by `services/api`. `services/github-app` exposes
an internal API used by the public API. `services/mailer` exposes one internal
delivery endpoint. Source route tables and shared schemas remain authoritative
when prose and code disagree.

## Common Public API Conventions

- Browser clients send credentials for session-protected routes.
- Portal identifies itself with `X-Client-Id: portal` where required.
- CORS responses vary by accepted origin and allow credentials only for
  configured clients.
- Session cookies are HTTP-only and use deployment-appropriate secure and
  same-site settings.
- Authenticated endpoints reject missing, invalid, revoked, or blacklisted
  sessions.
- Validation failures use `400`; authentication failures use `401`;
  authorization failures use `403`; missing resources use `404`; stale or
  conflicting changes use `409`; upstream failures use `502` where applicable.

During the optimization program, the existing mix of JSON and text errors is
preserved for compatibility. The target versioned error and operation
contracts are defined in
[Repository Optimization Design](REPOSITORY_OPTIMIZATION_DESIGN.md).

## Authentication and Account Routes

| Method                 | Route                     | Purpose                          |
| ---------------------- | ------------------------- | -------------------------------- |
| `POST`                 | `/auth/signup`            | Begin account signup             |
| `POST`                 | `/auth/magic-code`        | Request a sign-in code           |
| `POST`                 | `/auth/magic-code/verify` | Verify a sign-in code            |
| `GET`                  | `/auth/verify`            | Verify the current session       |
| `GET`, `POST`, `PATCH` | `/auth/logout`            | Clear or revoke sessions         |
| `GET`                  | `/auth/google`            | Start Google OAuth               |
| `GET`                  | `/auth/google/callback`   | Complete Google OAuth            |
| `GET`                  | `/auth/github`            | Start GitHub OAuth               |
| `GET`                  | `/auth/github/callback`   | Complete GitHub OAuth            |
| `GET`, `PATCH`         | `/api/me`                 | Read or update current user      |
| `PATCH`                | `/api/me/notifications`   | Update notification preferences  |
| `DELETE`               | `/api/me/oauth/github`    | Disconnect GitHub OAuth          |
| `PATCH`                | `/api/user/permissions`   | Update permitted user attributes |

OAuth redirect targets must be validated against registered clients. Allowed
account domains are defined in API source configuration and are not inferred
from arbitrary request input.

## Passkey Routes

| Method   | Route                            |
| -------- | -------------------------------- |
| `POST`   | `/auth/passkey/register/options` |
| `POST`   | `/auth/passkey/register/verify`  |
| `POST`   | `/auth/passkey/login/options`    |
| `POST`   | `/auth/passkey/login/verify`     |
| `GET`    | `/auth/passkey/credentials`      |
| `GET`    | `/auth/passkey/credentials/:id`  |
| `PATCH`  | `/auth/passkey/credentials/:id`  |
| `DELETE` | `/auth/passkey/credentials/:id`  |
| `POST`   | `/auth/passkey/revoke`           |

Registration and management require an authorized session. Login challenges
are short-lived and bound to the relying-party configuration.

## People Routes

| Method   | Route                                       | Purpose                   |
| -------- | ------------------------------------------- | ------------------------- |
| `GET`    | `/api/people/v2/me`                         | Read public profile state |
| `GET`    | `/api/people/v2/me/schema`                  | Read editable schema      |
| `GET`    | `/api/people/v2/me/pr`                      | Read draft PR state       |
| `POST`   | `/api/people/v2/me/pr`                      | Submit profile draft      |
| `PUT`    | `/api/people/v2/me/pr`                      | Update profile draft      |
| `POST`   | `/api/people/v2/me/student-placement`       | Submit placement metadata |
| `GET`    | `/api/people/v2/admin/student-placement`    | Read placement source     |
| `GET`    | `/api/people/v2/admin/student-placement/pr` | Read placement PR state   |
| `PUT`    | `/api/people/v2/admin/student-placement/pr` | Update placement PR       |
| `DELETE` | `/api/people/v2/admin/student-placement/pr` | Discard placement PR      |
| varies   | `/api/people/v2/admin/users/:identity/...`  | Admin profile operations  |

## Project and Academic Routes

| Methods                        | Route                                 |
| ------------------------------ | ------------------------------------- |
| `GET`                          | `/api/projects/v2/projects`           |
| `GET`, `POST`, `PUT`, `DELETE` | `/api/projects/v2/projects/:slug/...` |
| `GET`                          | `/api/academic/v2/courses`            |
| `GET`, `PUT`, `DELETE`         | `/api/academic/v2/courses/:id/...`    |
| `GET`                          | `/api/academic/v2/offerings`          |
| `GET`, `PUT`, `DELETE`         | `/api/academic/v2/offerings/:id/...`  |

Exact detail, schema, and PR suffixes are matched by
`services/api/src/routes/index.ts`. Mutations validate records with
`@scs/schemas` before calling the GitHub App.

## Administration and Proxy Routes

| Method                   | Route                             |
| ------------------------ | --------------------------------- |
| `GET`                    | `/api/admin/users`                |
| `GET`, `PATCH`, `DELETE` | `/api/admin/users/:email`         |
| `GET`                    | `/api/admin/actions`              |
| `POST`                   | `/api/admin/actions/:actionId`    |
| `GET`                    | `/user/proxy/all`                 |
| `GET`                    | `/user/proxy/all-url`             |
| `GET`                    | `/user/proxy/read-url`            |
| `GET`, `POST`, `PATCH`   | `/user/proxy`                     |
| `POST`                   | `/user/proxy/reset`               |
| `POST`                   | `/api/admin/proxy/reset-attempts` |
| `POST`                   | `/api/admin/proxy/build`          |

Admin routes require a non-blacklisted super-admin. The current user and proxy
list endpoints are scheduled for bounded cursor pagination; consumers must not
assume unlimited arrays are permanent contracts.

## Internal GitHub App API

Every route requires `X-Internal-Secret`. It is not a browser API.

Route groups:

- `/user/access-config`
- `/user/proxy-settings`
- `/user/repository-permission`
- `/people/public-profile` and `/people/public-profile/pr`
- `/people/student-placement/pr`
- `/projects/public-project` and `/projects/public-project/pr`
- `/projects/public-projects`
- `/academic/public-course` and `/academic/public-course/pr`
- `/academic/public-courses`
- `/academic/public-course-offering` and its PR route
- `/academic/public-course-offerings`

The current mutations are synchronous. The approved target adds idempotent
`202 Accepted` operation resources while retaining compatibility during Portal
migration.

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
authentication, and SMTP failures return `400`, `401`, and `502` respectively.
