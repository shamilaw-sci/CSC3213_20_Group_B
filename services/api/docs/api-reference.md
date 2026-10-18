# API Reference

Reference for the SCS PDN API in `api.scs.pdn.ac.lk`.

- Base URL: `https://api.scs-pdn.space`
- Runtime: Cloudflare Worker with a thin entrypoint in `src/index.ts` and route dispatch in `src/routes/index.ts`

This document reflects the current source code, not the intended design.

## Overview

The API provides:

- Email/passwordless login with magic codes
- Google OAuth
- GitHub OAuth
- JWT session verification and logout
- User profile and notification settings
- Public people-directory profile PR submission
- Public project metadata PR submission
- Admin permission management
- WebAuthn passkeys
- A proxy record API backed by the permission record

## Common Conventions

### CORS

The API only emits CORS headers for allowed origins:

- `https://portal.scs-pdn.space`
- `https://portal.scs.pdn.ac.lk`

Passkey option routes and credential listing check the `Origin` header against allowed portal origins. Passkey verification routes use the origin stored in the signed challenge cookie, and credential rename/delete routes do not directly check `Origin`.

### Client ID header

Many authenticated routes require:

- `X-Client-Id: portal`

The only allowed client ID in the current code is `portal`.

Routes that do not use `X-Client-Id`:

- `GET /auth/google`
- `GET /auth/google/callback`
- `GET /auth/github`
- `GET /auth/github/callback`
- `GET|POST|PATCH /auth/logout`

### Cookies

The API uses these cookies:

| Cookie              | Purpose            | Attributes                                                                     |
| ------------------- | ------------------ | ------------------------------------------------------------------------------ |
| `session`           | JWT session token  | `HttpOnly; Secure; SameSite=Lax; Domain=.scs-pdn.space; Path=/; Max-Age=18000` |
| `oauth_state`       | OAuth CSRF state   | `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=18000`                        |
| `passkey_challenge` | WebAuthn challenge | `HttpOnly; Secure; SameSite=None; Path=/; Max-Age=300`                         |

### Allowed email domains

Email-based sign-up and login are restricted to:

- `pdn.ac.lk`
- `sci.pdn.ac.lk`

The helper also requires the address to contain exactly one `@`.

### Response styles

The API returns a mix of:

- JSON responses
- Plain text error responses
- Redirects with `302`
- Empty `200` responses for logout

## Auth Endpoints

### `POST /auth/signup`

Creates a permission record if one does not already exist, then returns a signed JWT token in JSON.

Headers:

- `X-Client-Id: portal`
- `Content-Type: application/json`

Body:

```json
{
  "email": "student@pdn.ac.lk",
  "name": "Optional display name",
  "picture": "https://example.com/avatar.png"
}
```

Rules:

- `email` is required.
- `name` is optional, must be a string when present, is trimmed, and is capped at 100 characters.
- `picture` is optional and must be a string when present. Valid `http:` and `https:` URLs up to 2048 characters are stored; invalid picture URLs are ignored rather than rejected.

Success:

```json
{ "token": "eyJhbGciOiJIUzI1NiJ9..." }
```

Errors:

- `400` `Missing client context`
- `403` `Unauthorized client_id`
- `400` `{ "error": "Email required" }`
- `400` `{ "code": "invalid_body", "message": "Request body must be valid JSON" }`
- `400` `{ "code": "email_invalid", "message": "Email must be a string", "field": "email" }`
- `400` `{ "code": "name_invalid", "message": "Name must be a string", "field": "name" }`
- `400` `{ "code": "picture_invalid", "message": "Picture must be a string", "field": "picture" }`
- `400` `{ "error": "Unauthorized email domain", "message": "...", "allowed_domains": ["pdn.ac.lk", "sci.pdn.ac.lk"] }`

Notes:

- If the user does not already exist in KV, a new permission record is created with `name`, `picture`, and `createdAt`.
- This route returns a token body only. It does not set the `session` cookie.

### `POST /auth/magic-code`

Generates a 6-digit one-time verification code, stores it for 5 minutes, and emails it to the user.

Headers:

- `X-Client-Id: portal`
- `Content-Type: application/json`

Body:

```json
{ "email": "student@pdn.ac.lk" }
```

Success:

```json
{ "message": "Magic code sent", "expiresIn": 300 }
```

Errors:

- `400` `Missing client context`
- `403` `Unauthorized client_id`
- `400` `{ "error": "Email required" }`
- `400` `{ "code": "invalid_body", "message": "Request body must be valid JSON" }`
- `400` `{ "code": "email_invalid", "message": "Email must be a string", "field": "email" }`
- `400` `{ "error": "Unauthorized email domain", "message": "Use your @pdn.ac.lk or @sci.pdn.ac.lk email." }`
- `500` `{ "error": "Failed to send email. Please try again later." }`

Notes:

- The code is stored in `MAGIC_CODES` with a 300 second TTL.
- The code is one-time use.

### `POST /auth/magic-code/verify`

Verifies a magic code and starts a session.

Headers:

- `X-Client-Id: portal`
- `Content-Type: application/json`

Body:

```json
{
  "email": "student@pdn.ac.lk",
  "code": "123456"
}
```

Success:

- `200`

```json
{
  "verified": true,
  "redirectTo": "https://portal.scs-pdn.space/dashboard"
}
```

- `Set-Cookie: session=...`

Errors:

- `400` `Missing client context`
- `403` `Unauthorized client_id`
- `400` `{ "error": "magic_code_missing" }`
- `401` `{ "error": "magic_code_invalid" }`

Notes:

- If the user has no permission record yet, one is created automatically with `createdAt`.
- The response is JSON. OAuth provider flows are the redirect-based auth paths.

### `GET /auth/verify`

Validates the session cookie.

Headers:

- `X-Client-Id: portal`
- `Cookie: session=...`

Success:

```json
{ "valid": true, "email": "student@pdn.ac.lk", "role": "USER" }
```

Errors:

- `401` `Missing token`
- `400` `Missing client context`
- `403` `Unauthorized client_id`
- `401` `Token revoked`
- `401` `Invalid token`

Notes:

- The JWT is verified with `JWT_SECRET`, `JWT_ISSUER`, and the supplied client ID as the audience.
- Revoked JWT IDs are checked against `TOKEN_BLACKLIST`.

### `GET /auth/logout`

Logs the user out and clears cookies.

Success:

- `200` empty body

Notes:

- Logout is best-effort and always returns `200`, even if the session cookie is missing or invalid.
- If the session is valid, the token ID is blacklisted for the remaining lifetime.
- `session` and `oauth_state` cookies are cleared when possible.

### `POST /auth/logout`

Same behavior as `GET /auth/logout`.

### `PATCH /auth/logout`

Same behavior as `GET /auth/logout`.

## OAuth Endpoints

### `GET /auth/google`

Starts the Google OAuth flow.

Query parameters:

| Name        | Required | Purpose                                            |
| ----------- | -------- | -------------------------------------------------- |
| `client_id` | Yes      | Must be `portal`                                   |
| `signup`    | No       | If `true`, enables signup mode                     |
| `prompt`    | No       | If `select_account`, forwards the prompt to Google |

Success:

- `302` redirect to Google OAuth
- `Set-Cookie: oauth_state=...`

Errors:

- `400` `Missing client_id`
- `400` `Invalid client_id`

Notes:

- The OAuth state cookie contains a signed payload with the CSRF token, client ID, and signup flag.
- The Google authorization request uses `scope=openid email profile`.

### `GET /auth/google/callback`

Handles the Google OAuth callback.

Inputs:

- Query parameters from Google: `code`, `state`, or `error`
- Cookie: `oauth_state=...`

Success:

- `302` redirect to the portal dashboard
- `Set-Cookie: session=...`
- `Set-Cookie: oauth_state=; Max-Age=0`

Plain text errors:

- `400` `Missing state`
- `403` `Invalid or expired state`
- `403` `Invalid state payload`

Redirect error codes:

- `google_access_denied`
- `invalid_state`
- `missing_code`
- `token_exchange_failed`
- `invalid_id_token`
- `invalid_google_account`
- `workspace_account_required`
- `user_already_exists`
- `user_not_registered`
- `user_blacklisted`
- `google_oauth_not_allowed`
- `session_creation_failed`

Behavior:

1. Verifies the `oauth_state` cookie.
2. Compares the returned state against the CSRF value.
3. Exchanges the code with Google.
4. Verifies the Google ID token against Google JWKS.
5. Requires a verified email address from an allowed workspace domain.
6. In signup mode, creates a permission record if one does not exist.
7. In login mode, requires an existing permission record.
8. Requires the account to be allowed for Google OAuth.
9. Creates a session via the internal login flow and redirects to the dashboard.

### `GET /auth/github`

Starts the GitHub OAuth flow.

Query parameters:

| Name           | Required | Purpose                           |
| -------------- | -------- | --------------------------------- |
| `redirect_uri` | Yes      | Client-side error redirect target |
| `client_id`    | Yes      | Must be `portal`                  |

Success:

- `302` redirect to GitHub OAuth
- `Set-Cookie: oauth_state=...`

Errors:

- `400` `Missing redirect_uri`
- `302` redirect to `redirect_uri?error=missing_client_id`
- `302` redirect to `redirect_uri?error=invalid_client_id`

Notes:

- The actual GitHub OAuth redirect URI is fixed by `GITHUB_REDIRECT_URI` in env.
- The `redirect_uri` query param is only used for client-side error handling.

### `GET /auth/github/callback`

Handles the GitHub OAuth callback.

Inputs:

- Query parameters from GitHub: `code`, `state`
- Cookie: `oauth_state=...`

Success:

- `302` redirect to the portal dashboard
- `Set-Cookie: session=...`
- `Set-Cookie: oauth_state=; Max-Age=0`

Plain text errors:

- `400` `Missing state`
- `403` `Invalid or expired state`
- `403` `Invalid state payload`

Redirect error codes:

- `missing_code`
- `invalid_state`
- `token_exchange_failed`
- `invalid_github_token`
- `github_user_fetch_failed`
- `github_email_fetch_failed`
- `no_valid_email`
- `multiple_valid_emails`
- `google_account_required`
- `user_blacklisted`
- `github_account_mismatch`
- `failed_to_create_session`

Behavior:

1. Verifies the OAuth state cookie.
2. Exchanges the code for a GitHub access token.
3. Fetches the GitHub profile and email list.
4. Keeps only verified, non-noreply emails in allowed workspace domains.
5. Requires exactly one valid email.
6. Requires an existing permission record for that email.
7. Links the GitHub user ID on first login.
8. Rejects login if the linked GitHub ID changes later.
9. Creates a session and redirects to the dashboard.

## Profile and Permission Endpoints

### `GET /api/me`

Returns the current user's profile summary and permission flags.

Headers:

- `X-Client-Id: portal`
- `Cookie: session=...`

Success:

```json
{
  "email": "student@pdn.ac.lk",
  "name": "Student Name",
  "picture": "https://example.com/avatar.png",
  "role": "USER",
  "blacklisted": false,
  "lastPasswordChanged": null,
  "googleOAuth": true,
  "githubOAuth": false,
  "githubUserID": 12345678,
  "pictureMode": "manual",
  "gravatarMail": null,
  "isEmailNotificationEnabled": true,
  "isPushNotificationEnabled": false
}
```

Errors:

- `401` `Unauthorized`
- `400` `Missing X-Client-Id header`
- `401` `Invalid token`
- `404` `User not found`

Notes:

- `googleOAuth` and `githubOAuth` are derived from `oAuthProviders`.
- The route uses the email from the JWT and the stored permission record.
- Accounts with role `USER` can call this endpoint but are forbidden from self-service mutation endpoints.

### `PATCH /api/me`

Updates the logged-in user's display name and profile picture source.

Body:

```json
{
  "name": "Student Name",
  "pictureMode": "manual",
  "picture": "https://example.com/avatar",
  "gravatarMail": null
}
```

Notes:

- `pictureMode` can be `google`, `github`, `manual`, or `gravatar`.
- Manual picture URLs do not need a file extension.
- Manual picture URLs are server-verified with `HEAD`, then a small ranged `GET` fallback when needed.
- Manual picture content type must be `image/png`, `image/jpeg`, or `image/webp`.

### `PATCH /api/me/notifications`

Updates the logged-in user's notification preferences.

Headers:

- `X-Client-Id: portal`
- `Cookie: session=...`
- `Content-Type: application/json`

Body:

```json
{
  "notifications": {
    "email": true,
    "push": false
  }
}
```

Success:

- `200` `Permission updated`

Errors:

- `401` from session verification
- `401` `Unauthorized`
- `404` `User not found`
- `403` `Forbidden`
- `500` `Internal Server Error`

Notes:

- Missing fields fall back to the existing stored values.
- Blacklisted users are rejected.

### `DELETE /api/me/oauth/github`

Removes the current user's GitHub OAuth link.

Headers:

- `X-Client-Id: portal`
- `Cookie: session=...`

Success:

- `200` `GitHub OAuth removed`

Behavior:

- Sets `oAuthProviders.github` to `false`
- Removes `githubUserID`

Errors:

- `401` from session verification
- `401` `Unauthorized`
- `404` `User not found`
- `403` `Forbidden`
- `500` `Internal Server Error`

## Public People Profile Endpoints

These routes are authenticated portal routes for editing public profile JSON in
the `data.scs.pdn.ac.lk` repository. The API validates payloads with
`@scs/schemas`, derives the target
`public/people/v2/...` files, and delegates GitHub branch/PR work to the internal
SCS Portal GitHub App. The API does not store public profile data in KV or a
database.

Supported profile kinds:

- `academic`
- `academic-support`
- `non-academic`
- `student`

Students always submit `profileKind: "student"`. Honours students set
`studentTrack: "HONOURS"` in the profile and send `stream` as the matching
faculty special directory slug, such as `computer-science`, `data-science`,
`applied-science`, or `statistics-and-operations-research`.

Write targets:

- Staff profiles update `public/people/v2/users/:username.json`, one
  faculty-wide staff aggregate file, and the department-wise staff aggregate
  file when `department` is present.
- Student profiles update `public/people/v2/users/:snumber.json` and
  `public/people/v2/students/:batch.json`.
- Honours student profiles update those same student files plus
  `public/people/v2/special/:stream/:batch.json`.

### `GET /api/people/v2/me`

Fetches the signed-in user's public profile JSON from
`public/people/v2/users/:username.json` via the GitHub App.

Headers:

- `X-Client-Id: portal`
- `Cookie: session=...`

Success:

```json
{
  "profile": {
    "title": "Mr",
    "fullName": "Student Name",
    "registrationNo": "S21513",
    "studentType": "UNDERGRADUATE",
    "studentTrack": "HONOURS",
    "level": "4000",
    "status": "CURRENT"
  }
}
```

If no profile file exists, `profile` is `null`.

### `GET /api/people/v2/me/schema`

Returns the profile kinds the signed-in user may submit.

Success:

```json
{
  "allowedKinds": ["student"],
  "specialStreams": [
    "biomedical-science",
    "botany",
    "computer-science",
    "data-science",
    "geology",
    "mathematics",
    "microbiology",
    "molecular-biology",
    "physics",
    "statistics",
    "zoology",
    "applied-science",
    "statistics-and-operations-research"
  ],
  "note": "Submit profile JSON matching @scs/schemas."
}
```

Role mapping:

- `ACADEMIC` can submit `academic`.
- `ACADEMIC_SUPPORT` can submit `academic-support`.
- `NON_ACADEMIC` can submit `non-academic`.
- `STUDENT` can submit `student`.
- `USER` and `OTHER` cannot submit public profile data.

### `GET /api/people/v2/me/pr`

Returns the latest public profile PR state for the signed-in user.

Success:

```json
{
  "status": "open",
  "number": 123,
  "url": "https://github.com/org/data.scs.pdn.ac.lk/pull/123",
  "branch": "profile/s21513-2026-07-15t12-00-00-000z",
  "canEdit": true
}
```

Known statuses are `none`, `open`, `merged`, `closed`, `checks_pending`,
`checks_failed`, and `auto_merge_queued`.

### `PUT /api/people/v2/me/pr`

Validates the submitted public profile, then creates or updates a GitHub PR in
the people data repository. If an open PR exists for the user, the API updates
that PR branch. If the previous PR is merged or closed, a new PR branch is
created.

Body:

```json
{
  "profileKind": "student",
  "stream": "computer-science",
  "profile": {
    "title": "Mr",
    "fullName": "Student Name",
    "registrationNo": "S21513",
    "studentType": "UNDERGRADUATE",
    "studentTrack": "HONOURS",
    "level": "4000",
    "status": "CURRENT"
  }
}
```

Success:

```json
{
  "status": "open",
  "number": 123,
  "url": "https://github.com/org/data.scs.pdn.ac.lk/pull/123",
  "branch": "profile/s21513-2026-07-15t12-00-00-000z",
  "canEdit": true
}
```

Errors:

- `400` invalid JSON, invalid profile kind, invalid honours stream, schema
  validation failure, or unable to derive target files.
- `401` missing or invalid session.
- `403` forbidden role/profile kind or profile identity mismatch.

### `POST /api/people/v2/me/pr`

Same behavior as `PUT /api/people/v2/me/pr`.

## Projects Endpoints

Project metadata edit routes require:

- `X-Client-Id: portal`
- `Cookie: session=...`

The API validates submitted project JSON with
`@scs/schemas` `ProjectSchema`, authorizes the
caller, derives the data-repository paths, then calls the SCS Portal GitHub App.

Who can edit:

- Super admins can edit any project.
- Non-admin users can edit only when the submitted project includes them in
  `project.people` by matching `email`, `username`, or `sNumber`.

### `GET /api/projects/v2/projects/:slug`

Returns the public project JSON from the GitHub App/data repository. Missing
project files return `200` with `{ "project": null }`.

### `GET /api/projects/v2/projects/:slug/schema`

Returns submission metadata for the signed-in user, including whether they can
submit any project as a super admin or only projects that list them as a person.

### `GET /api/projects/v2/projects/:slug/pr`

Returns the latest project-data PR status for the slug.

Success:

```json
{
  "status": "open",
  "number": 123,
  "url": "https://github.com/csc3213-2026-group-b/data.scs.pdn.ac.lk/pull/123",
  "branch": "project/scholarship-management-system",
  "canEdit": true
}
```

### `PUT /api/projects/v2/projects/:slug/pr`

Creates or updates a project-data PR through the GitHub App. `POST` behaves the
same as `PUT`.

Body:

```json
{
  "project": {
    "id": "prj-scholarship-management-system",
    "slug": "scholarship-management-system",
    "title": "Scholarship Management System",
    "shortDescription": "A workflow platform for scholarship applications.",
    "description": "A workflow platform for scholarship applications, eligibility checks, review decisions, and student account linking.",
    "projectType": "COURSE_PROJECT",
    "status": "COMPLETED",
    "categories": ["department-systems"],
    "tags": ["scholarships"],
    "academicYear": "2024/2025",
    "course": {
      "code": "CSC3213",
      "title": "Software Engineering Project"
    },
    "people": [
      {
        "name": "Student Name",
        "role": "student",
        "email": "s21513@sci.pdn.ac.lk",
        "username": "s21513",
        "sNumber": "S21513"
      }
    ],
    "links": {},
    "source": {
      "kind": "MANUAL",
      "curator": "SCS Projects Team"
    },
    "media": {
      "icon": "FolderKanban"
    },
    "dates": {
      "lastUpdatedAt": "2026-07-24"
    }
  }
}
```

Success returns the GitHub App PR status object. The GitHub App writes to a
stable `project/<slug>` branch and the data repository workflow reconciles
shared project indexes before merge.

### `PATCH /api/user/permissions`

Updates any user's permission record by merging a partial permission object into the stored record.

Headers:

- `X-Client-Id: portal`
- `Cookie: session=...`
- `Content-Type: application/json`

Body:

```json
{
  "email": "student@pdn.ac.lk",
  "permission": {
    "role": "ACADEMIC",
    "blacklisted": false
  }
}
```

Success:

- `200` `Permission updated`

Errors:

- `400` `Bad Request`
- `401` from session verification
- `401` `Unauthorized`
- `403` `Forbidden`
- `404` `User not found`
- `500` `Internal Server Error`

Notes:

- This route is super-admin only.
- The provided `permission` object is shallow-merged onto the existing record.

## Admin Endpoints

These routes require `X-Client-Id: portal`, a valid session, a non-blacklisted account, and access level `SUPER_ADMIN`.

### `GET /api/admin/actions`

Returns schema-described maintenance actions that the portal can render as buttons.

Success:

```json
{
  "schemaVersion": 1,
  "actions": []
}
```

Errors:

- `401` from session verification
- `403` `Forbidden`

### `POST /api/admin/actions/:actionId`

Runs one schema-described maintenance action.

Current action IDs:

- None

Body:

```json
{}
```

The endpoint remains available for future schema-described actions. Unknown actions return `404`.

Success:

- No current actions.

Errors:

- `401` from session verification
- `403` `Forbidden`
- `404` `{ "error": "Action not found" }`

### `GET /api/admin/users`

Lists registered users from the permission KV.

Success:

```json
[
  {
    "id": "student@pdn.ac.lk",
    "email": "student@pdn.ac.lk",
    "name": "Student Name",
    "picture": "https://example.com/avatar.png",
    "role": "STUDENT",
    "accessLevel": "NONE",
    "blacklisted": false,
    "createdAt": 1710000000000
  }
]
```

Errors:

- `400` `Missing client context`
- `401` from session verification
- `401` `Unauthorized`
- `403` `Forbidden`
- `500` `Internal Server Error`

Notes:

- The implementation caps the returned list at 1000 users per request.
- Only the public user summary fields are returned, not the full permission record.

### `GET /api/admin/users/:email`

Returns the permission record for one user.

Path parameter:

- `email` is taken from the remainder of the path and URL-decoded

Success:

```json
{
  "role": "STUDENT",
  "blacklisted": false,
  "notifications": {
    "email": true,
    "push": false
  }
}
```

Errors:

- `400` `{ "error": "Email required" }`
- `400` `Missing client context`
- `401` from session verification
- `401` `Unauthorized`
- `403` `Forbidden`
- `404` `{ "error": "User not found" }`

Notes:

- The full stored permission object is returned.

### `PATCH /api/admin/users/:email`

Merges a partial permission update into a user's stored record.

Body:

```json
{
  "blacklisted": false,
  "role": "ACADEMIC"
}
```

Success:

```json
{
  "role": "ACADEMIC",
  "blacklisted": false
}
```

Errors:

- `400` `{ "error": "Email required" }`
- `400` `{ "error": "Invalid JSON body" }`
- `400` `{ "error": "Request body must be a JSON object" }`
- `400` `Missing client context`
- `401` from session verification
- `401` `Unauthorized`
- `403` `Forbidden`
- `404` `{ "error": "User not found" }`
- `500` `Internal Server Error`

### `DELETE /api/admin/users/:email`

Deletes one user's stored permission record.

Path parameter:

- `email` is taken from the remainder of the path and URL-decoded

Success:

- `204` empty body

Errors:

- `400` `{ "error": "Email required" }`
- `400` `Missing client context`
- `401` from session verification
- `401` `Unauthorized`
- `403` `Forbidden`
- `404` `{ "error": "User not found" }`
- `500` `Internal Server Error`

## Passkey Endpoints

Passkey routes require:

- `X-Client-Id: portal`
- An allowed `Origin` on registration options, login options, and credential listing
- A valid session for registration options, credential listing, credential rename/delete, and revoke

### `POST /auth/passkey/register/options`

Creates WebAuthn registration options and stores a challenge cookie.

Headers:

- `X-Client-Id: portal`
- `Cookie: session=...`
- `Content-Type: application/json`

Optional body:

```json
{ "name": "Laptop passkey" }
```

Success:

- `200` WebAuthn registration options JSON

Errors:

- `400` `Missing client context`
- `403` `Unauthorized client_id`
- `403` `{ "error": "Forbidden origin" }`
- `400` `{ "error": "Passkeys are not configured for this origin" }`
- `401` `{ "error": "Missing session" }`
- `401` `{ "error": "Invalid session" }`
- `401` `{ "error": "Token revoked" }`
- `403` `{ "error": "Forbidden" }`
- `409` `{ "code": "passkey_limit_reached", "message": "You can save up to 4 passkeys for this account." }`

Notes:

- The passkey limit is 4 per account.
- The RP ID is derived from the request origin.
- Excluding credentials is done only for the current RP ID.

### `POST /auth/passkey/register/verify`

Verifies a WebAuthn registration response and stores the new credential.

Headers:

- `X-Client-Id: portal`
- `Cookie: passkey_challenge=...`
- `Content-Type: application/json`

Body:

```json
{
  "response": {}
}
```

Success:

```json
{ "verified": true }
```

Errors:

- `400` `Missing client context`
- `403` `Unauthorized client_id`
- `401` `{ "error": "Missing passkey challenge" }`
- `401` `{ "error": "Invalid passkey challenge" }`
- `401` `{ "error": "Invalid or expired passkey challenge" }`
- `401` `{ "error": "Invalid client context" }`
- `400` `{ "error": "Passkey response required" }`
- `401` `{ "error": "Passkey registration failed" }`
- `403` `{ "error": "Forbidden" }`
- `409` `{ "code": "passkey_name_conflict", "message": "Passkey name already in use" }`

Notes:

- If no name is supplied, the server generates names like `Passkey 1`, `Passkey 2`, etc.
- The stored credential includes the public key, counter, transports, backup state, device type, RP ID, and timestamps.

### `POST /auth/passkey/login/options`

Creates WebAuthn authentication options and stores a challenge cookie.

Headers:

- `X-Client-Id: portal`
- `Content-Type: application/json`

Optional body:

```json
{ "email": "student@pdn.ac.lk" }
```

Behavior:

- If `email` is omitted, the route returns discoverable credential options.
- If `email` is provided, the user must already have a passkey registered for the current RP ID.

Success:

- `200` WebAuthn authentication options JSON

Errors:

- `400` `Missing client context`
- `403` `Unauthorized client_id`
- `403` `{ "error": "Forbidden origin" }`
- `400` `{ "error": "Passkeys are not configured for this origin" }`
- `400` `{ "error": "Unauthorized email domain" }`
- `403` `{ "error": "Passkey is not registered" }`

Notes:

- Discoverable flow is supported through resident credentials.
- The challenge cookie stores the client ID, origin, RP ID, and optional email.

### `POST /auth/passkey/login/verify`

Verifies a passkey login response and issues a session cookie.

Headers:

- `X-Client-Id: portal`
- `Cookie: passkey_challenge=...`
- `Content-Type: application/json`

Body:

```json
{
  "response": {}
}
```

Success:

```json
{ "verified": true }
```

Errors:

- `400` `Missing client context`
- `403` `Unauthorized client_id`
- `401` `{ "error": "Missing passkey challenge" }`
- `401` `{ "error": "Invalid passkey challenge" }`
- `401` `{ "error": "Invalid or expired passkey challenge" }`
- `401` `{ "error": "Invalid client context" }`
- `400` `{ "error": "Passkey response required" }`
- `403` `{ "error": "Passkey is not registered" }`
- `401` `{ "error": "Passkey authentication failed" }`

Notes:

- On success, the API also updates the passkey counter and last-used metadata.
- The response sets both a new `session` cookie and clears the passkey challenge cookie.

### `GET /auth/passkey/credentials`

Lists the authenticated user's passkeys for the current RP ID.

Headers:

- `X-Client-Id: portal`
- `Cookie: session=...`

Success:

```json
{ "credentials": [] }
```

Errors:

- `400` `Missing client context`
- `403` `Unauthorized client_id`
- `401` `{ "error": "Missing session" }`
- `401` `{ "error": "Invalid session" }`
- `401` `{ "error": "Token revoked" }`
- `404` `{ "error": "Not Found" }`
- `403` `{ "error": "Forbidden origin" }`

Notes:

- Only credentials for the current origin's RP ID are returned.

### `GET /auth/passkey/credentials/:id`

Registered as an alias of the credential rename handler.

Headers:

- `X-Client-Id: portal`
- `Cookie: session=...`
- `Content-Type: application/json`

Body:

```json
{ "name": "My new passkey name" }
```

Behavior:

- Without a valid JSON body containing `name`, it returns `400` `{ "error": "Missing name" }`.
- With a valid body, it renames the credential just like `PATCH /auth/passkey/credentials/:id`.

### `PATCH /auth/passkey/credentials/:id`

Renames one passkey credential.

Headers:

- `X-Client-Id: portal`
- `Cookie: session=...`
- `Content-Type: application/json`

Body:

```json
{ "name": "My new passkey name" }
```

Rules:

- `name` is required.
- If `name` is an empty string after trimming, the server generates a default unique name.

Success:

```json
{ "success": true }
```

Errors:

- `400` `Missing client context`
- `403` `Unauthorized client_id`
- `401` `{ "error": "Missing session" }`
- `401` `{ "error": "Invalid session" }`
- `401` `{ "error": "Token revoked" }`
- `400` `{ "error": "Missing credential id" }`
- `400` `{ "error": "Missing name" }`
- `404` `{ "error": "Not Found" }`
- `409` `{ "code": "passkey_name_conflict", "message": "Passkey name already in use" }`

### `DELETE /auth/passkey/credentials/:id`

Deletes one passkey credential from the authenticated user's account.

Success:

```json
{ "success": true }
```

Errors:

- `400` `Missing client context`
- `403` `Unauthorized client_id`
- `401` `{ "error": "Missing session" }`
- `401` `{ "error": "Invalid session" }`
- `401` `{ "error": "Token revoked" }`
- `400` `{ "error": "Missing credential id" }`
- `404` `{ "error": "Not Found" }`

### `POST /auth/passkey/revoke`

Super-admin utility for revoking a user or removing a passkey credential globally.

Headers:

- `X-Client-Id: portal`
- `Cookie: session=...`
- `Content-Type: application/json`

Body:

```json
{
  "userId": "student@pdn.ac.lk",
  "credentialId": "credential-id-to-remove"
}
```

Behavior:

- If `userId` is present, that user is blacklisted.
- If `credentialId` is present, the matching credential is removed from every user who has it.

Success:

```json
{ "success": true }
```

Errors:

- `400` `Missing client context`
- `403` `Unauthorized client_id`
- `401` `{ "error": "Missing session" }`
- `401` `{ "error": "Invalid session" }`
- `401` `{ "error": "Token revoked" }`
- `403` `{ "error": "Forbidden" }`
- `404` `{ "error": "Not Found" }` when `userId` does not exist

Notes:

- If both fields are omitted, the route still returns success.

## Proxy Endpoint

### `GET /user/proxy/all`

Returns a paginated list of users who already have proxy records. This is a super-admin endpoint used by the portal proxy management page.

Headers:

- `X-Client-Id: portal`
- `Cookie: session=...`

Query parameters:

| Name   | Required | Purpose                               |
| ------ | -------- | ------------------------------------- |
| `page` | No       | 1-based page number. Defaults to `1`. |

Success:

```json
{
  "proxies": [
    {
      "email": "student@pdn.ac.lk",
      "username": "student",
      "proxyUrl": "https://example.com",
      "active": true,
      "availableAttempts": 5,
      "updatedAt": 1710000000000,
      "editedBy": "admin@pdn.ac.lk"
    }
  ],
  "page": 1,
  "totalPages": 1,
  "total": 1
}
```

Errors:

- `400` `Missing X-Client-Id header`
- `401` `Unauthorized`
- `401` `Invalid token`
- `403` `Forbidden`
- `404` `User not found`

### `GET /user/proxy`

Returns the proxy record for the current user, or for another user when the caller is a super-admin.

Headers:

- `X-Client-Id: portal`
- `Cookie: session=...`

Query parameters:

| Name    | Required | Purpose                                       |
| ------- | -------- | --------------------------------------------- |
| `email` | No       | Super-admins can inspect another user's proxy |

Success:

```json
{
  "isAllowed": true,
  "canEdit": true,
  "proxy": {
    "proxyUrl": "https://...",
    "active": true,
    "availableAttempts": 5,
    "updatedAt": 1710000000000,
    "editedBy": "student@pdn.ac.lk"
  }
}
```

Errors:

- `400` `Missing X-Client-Id header`
- `401` `Unauthorized`
- `401` `Invalid token`
- `404` `User not found`
- `403` `Forbidden`

Notes:

- If the current user has no proxy entry yet, the API creates one automatically on self-lookup.
- `isAllowed` is effectively "proxy entry exists".
- `canEdit` is true for the owner and for super-admins.
- If a super-admin looks up another user who has no proxy yet, the response is `proxy: null` and `isAllowed: false`.

### `POST /user/proxy`

Creates or updates a proxy record.

Headers:

- `X-Client-Id: portal`
- `Cookie: session=...`
- `Content-Type: application/json`

Body:

```json
{
  "email": "other-user@pdn.ac.lk",
  "active": true,
  "proxyUrl": "https://example.com",
  "isAllowed": true
}
```

Behavior:

- Non-admins can only edit their own proxy.
- Non-admins cannot change `isAllowed`.
- If the current user has no proxy yet, one is created automatically for self-editing.
- Each successful update decrements `availableAttempts` by 1, with a daily reset after 24 hours of inactivity.
- `isAllowed` is a request-time authorization flag, not a stored proxy field.
- `editedBy` and `updatedAt` request fields are accepted by validation but ignored by the save path.

Success:

```json
{
  "success": true,
  "proxy": {
    "proxyUrl": "https://example.com",
    "active": true,
    "availableAttempts": 4,
    "updatedAt": 1710000000000,
    "editedBy": "student@pdn.ac.lk"
  }
}
```

Errors:

- `400` `Missing X-Client-Id header`
- `400` `Invalid JSON body`
- `400` `{ "code": "invalid_proxy_url", "message": "Enter a valid HTTP or HTTPS proxy URL.", "field": "proxyUrl" }`
- `400` `{ "code": "invalid_proxy_update", "message": "...", "field": "..." }`
- `401` `Unauthorized`
- `401` `Invalid token`
- `404` `User not found`
- `403` `Forbidden: only admin can edit other user's proxy`
- `403` `Forbidden: only admin can change isAllowed`
- `403` `Forbidden: only admin can edit other's proxy`
- `404` `Proxy entry not found`
- `409` `{ "code": "proxy_attempts_exhausted", "message": "You have used all your editing attempts for today." }`
- `500` `Internal Server Error`

### `POST /api/admin/proxy/reset-attempts`

Resets proxy edit attempts for a target user. This is a super-admin endpoint used by the portal proxy management page.

Headers:

- `X-Client-Id: portal`
- `Cookie: session=...`
- `Content-Type: application/json`

Body:

```json
{
  "email": "student@pdn.ac.lk"
}
```

Success:

```json
{
  "success": true,
  "proxy": {
    "proxyUrl": "https://example.com",
    "active": true,
    "availableAttempts": 5,
    "updatedAt": 1710000000000,
    "editedBy": "student@pdn.ac.lk"
  }
}
```

Errors:

- `400` `Missing X-Client-Id header`
- `400` `{ "code": "invalid_json_body", "message": "Invalid JSON body" }`
- `400` `{ "code": "missing_email", "message": "Email is required." }`
- `401` `Unauthorized`
- `401` `Invalid token`
- `403` `Forbidden`
- `404` `{ "code": "proxy_not_found", "message": "Proxy entry not found." }`

### `POST /api/admin/proxy/build`

Generates the current active proxy manifest for super-admins. The endpoint does not publish to an external CDN; it returns the manifest JSON generated from KV.

Headers:

- `X-Client-Id: portal`
- `Cookie: session=...`

Success:

```json
{
  "success": true,
  "generatedAt": 1710000000000,
  "proxies": [
    {
      "email": "student@pdn.ac.lk",
      "username": "student",
      "proxyUrl": "https://example.com",
      "active": true,
      "updatedAt": 1710000000000,
      "editedBy": "admin@pdn.ac.lk"
    }
  ]
}
```

Errors:

- `400` `Missing X-Client-Id header`
- `401` `Unauthorized`
- `401` `Invalid token`
- `403` `Forbidden`
- `404` `User not found`

### `PATCH /user/proxy`

Same behavior as `POST /user/proxy`.

### `POST /user/proxy/reset`

Resets proxy edit attempts to the default count for the current user, or for another user when the caller is a super-admin.

Headers:

- `X-Client-Id: portal`
- `Cookie: session=...`
- `Content-Type: application/json`

Optional body:

```json
{
  "email": "other-user@pdn.ac.lk"
}
```

Behavior:

- Without `email`, resets the current user's proxy attempts.
- With another user's `email`, the caller must be a super-admin.
- The target user must already have a proxy entry.

Success:

```json
{
  "success": true,
  "proxy": {
    "proxyUrl": "https://example.com",
    "active": true,
    "availableAttempts": 5,
    "updatedAt": 1710000000000,
    "editedBy": "student@pdn.ac.lk"
  }
}
```

Errors:

- `400` `Missing X-Client-Id header`
- `400` `{ "code": "invalid_proxy_update", "message": "...", "field": "..." }`
- `401` `Unauthorized`
- `401` `Invalid token`
- `403` `Forbidden`
- `403` `Forbidden: only admin can reset other user's proxy attempts`
- `404` `User not found`
- `404` `Proxy entry not found`

## Data Models

### Permission

Stored in KV under `permissions:<lowercase-email>`.

`role` is the required person role. Valid values are `USER`, `OTHER`, `STUDENT`, `ACADEMIC`, `NON_ACADEMIC`, and `ACADEMIC_SUPPORT`. `accessLevel` is the inherited management permission and can be `NONE`, `ADMIN`, or `SUPER_ADMIN`. New accounts default to `STUDENT` when the lowercase email username matches `sYYXXX` or `sYYspXXX` (`YY` and `XXX` are digits); all other allowed-domain usernames default to `ACADEMIC` for now.

```json
{
  "role": "ACADEMIC",
  "accessLevel": "SUPER_ADMIN",
  "include": {
    "repo-name": "ADMIN"
  },
  "exclude": ["repo-name"],
  "proxy": {
    "proxyUrl": "https://...",
    "active": true,
    "availableAttempts": 5,
    "updatedAt": 1710000000000,
    "editedBy": "student@pdn.ac.lk"
  },
  "blacklisted": false,
  "githubUserID": 12345678,
  "notifications": {
    "email": true,
    "push": false
  },
  "lastPasswordChanged": 1710000000000,
  "oAuthProviders": {
    "google": true,
    "github": true
  },
  "passkeys": [],
  "name": "Student Name",
  "picture": "https://example.com/avatar.png",
  "pictureMode": "manual",
  "gravatarMail": null,
  "createdAt": 1710000000000
}
```

### ProxyEntry

```json
{
  "proxyUrl": "https://example.com",
  "active": true,
  "availableAttempts": 5,
  "updatedAt": 1710000000000,
  "editedBy": "student@pdn.ac.lk"
}
```

Notes:

- `availableAttempts` is decremented on every update.
- It resets to 5 if more than 24 hours passed since the last update.

### PasskeyCredential

```json
{
  "id": "credential-id",
  "publicKey": "base64url-encoded-public-key",
  "counter": 0,
  "transports": ["internal"],
  "backedUp": true,
  "deviceType": "multiDevice",
  "rpId": "scs-pdn.space",
  "createdAt": 1710000000000,
  "lastUsedAt": 1710000000000,
  "name": "Laptop passkey"
}
```

### UserData

Used by `GET /api/admin/users`.

```json
{
  "id": "student@pdn.ac.lk",
  "email": "student@pdn.ac.lk",
  "name": "Student Name",
  "picture": "https://example.com/avatar.png",
  "role": "STUDENT",
  "blacklisted": false,
  "createdAt": 1710000000000
}
```

## Default Router Responses

- `404` `{ "error": "Not Found" }` for unknown routes
- `405` `{ "error": "Method Not Allowed" }` for unsupported HTTP methods
- `500` `{ "error": "Internal Server Error" }` for uncaught top-level exceptions

## Practical Notes

- OAuth login flows redirect to the dashboard on success and to the login page on failure.
- The session JWT audience is the client ID, so the same token is only valid for the client it was issued for.
- Passkey registration and login are two-step flows: options first, then verify.
- Many endpoints return plain text errors, not JSON. Keep clients tolerant of both.
