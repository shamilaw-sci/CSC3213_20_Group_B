# GitHub App Automation

This service is triggered independently by the portal whenever a user setting or
RBAC setting changes. Each mutation is applied through the configured GitHub App
as an auditable pull request.

## Proposed Operating Plan

Use `public/{username}.json` as the single source of truth for each GitHub user.
The file contains both proxy settings and the repository allowlist used to limit
access to the GitHub organization.

Responsibilities:

- Portal: decides that a user setting changed and calls this service.
- This GitHub App service: validates the request and writes the user config
  change through a pull request.
- Config repository: stores one JSON file per GitHub username.
- Proxy or access-enforcement layer: reads the user file and maps
  `permissions.repo[owner/repo].permission` to the requested operation.

Recommended file shape:

```json
{
  "proxy": {
    "active": true,
    "url": "https://example.com/proxy",
    "updatedAt": "2026-07-08T10:00:00.000Z",
    "updatedBy": "portal-admin"
  },
  "permissions": {
    "repo": {
      "owner/repo-a": {
        "permission": "write",
        "updatedAt": "2026-07-08T10:00:00.000Z",
        "updatedBy": "portal-admin"
      },
      "owner/repo-b": {
        "permission": "admin",
        "updatedAt": "2026-07-08T10:05:00.000Z",
        "updatedBy": "portal-admin"
      }
    }
  }
}
```

Recommended read-access decision:

1. Normalize the GitHub username to the matching `public/{username}.json` file.
2. Deny access when the file does not exist.
3. Deny access when `proxy.active` is `false`.
4. Normalize the requested repository as `owner/repo`.
5. Allow the operation only when the stored permission is sufficient for the
   requested action.

The service writes only the nested schema shown above. Existing files with
another shape are treated as invalid config and will not be silently rewritten.

This service trusts only the upstream internal caller. The upstream service must
verify the real user, authorize the requested change, and pass that verified
actor in `updatedBy`.

## Pull Request Flow

For each accepted mutation request, the service:

1. Reads the configured repository default branch.
2. Creates a temporary `automation/...` branch from that default branch.
3. Writes the requested JSON config change to that branch.
4. Opens a pull request back to the default branch.
5. Squash-merges the pull request.
6. Deletes the temporary branch.
7. Returns the branch, commit SHA, pull request number, pull request URL, and
   merge status to the caller.

The HTTP request only succeeds after GitHub accepts the file update and merge.

## Authentication

Every route requires:

```http
X-Internal-Secret: your_internal_service_secret
```

The value must match `X_INTERNAL_SECRET`. JWT/session verification and
role-based authorization are intentionally handled by the upstream API before it
calls this service.

`updatedBy` is required in mutation request bodies and must be the verified
actor chosen by the upstream API.

## Environment Variables

```env
GITHUB_APP_ID='your_github_app_id'
GITHUB_PRIVATE_KEY='your_github_app_private_key'
GITHUB_INSTALLATION_ID='your_github_app_installation_id'
GITHUB_OWNER='your_github_owner'
GITHUB_CONFIG_REPOSITORY='your_config_repo'
X_INTERNAL_SECRET='your_internal_service_secret'
PORT=3000
```

`GITHUB_CONFIG_REPOSITORY` is the repository where per-user proxy and permission
config files are stored.

`GITHUB_PEOPLE_DATA_REPOSITORY` is the repository where public people-directory
JSON files are stored. It defaults to `GITHUB_CONFIG_REPOSITORY` when omitted,
but production should set it to `data.scs.pdn.ac.lk`.

`GITHUB_PROJECTS_DATA_REPOSITORY` is the repository where public projects JSON
files are stored. It defaults to `GITHUB_PEOPLE_DATA_REPOSITORY`, then
`GITHUB_CONFIG_REPOSITORY`, when omitted. Production should set it to
`data.scs.pdn.ac.lk`.

## GitHub App Permissions

Install the GitHub App on `GITHUB_CONFIG_REPOSITORY` with:

- Contents: read and write
- Pull requests: read and write
- Metadata: read

The configured repository branch protection must allow this GitHub App to merge
the generated pull requests. If required checks are enabled, the merge call will
fail until those checks pass.

For public people-profile automation, install the same GitHub App on
`GITHUB_PEOPLE_DATA_REPOSITORY` with:

- Contents: read and write
- Pull requests: read and write
- Issues: read and write, for PR labels
- Metadata: read

The profile PR flow intentionally does not merge inside this service. GitHub
Actions in the data repository should validate the changed JSON, apply the
`auto-merge-profile` policy, merge the PR, and publish `public/` to the CDN.

For public project automation, install the same GitHub App on
`GITHUB_PROJECTS_DATA_REPOSITORY` with the same permissions. Project PRs are
also left open for the data repository workflow to validate and merge.

## Read User Access Config

Endpoint:

```http
GET /user/access-config?username=github-user
X-Internal-Secret: your_internal_service_secret
```

Success response:

```json
{
  "proxy": {
    "active": true,
    "url": "https://example.com/proxy",
    "updatedAt": "2026-07-08T10:00:00.000Z",
    "updatedBy": "portal-admin"
  },
  "permissions": {
    "repo": {
      "owner/repo-a": {
        "permission": "write",
        "updatedAt": "2026-07-08T10:00:00.000Z",
        "updatedBy": "portal-admin"
      },
      "owner/repo-b": {
        "permission": "admin",
        "updatedAt": "2026-07-08T10:05:00.000Z",
        "updatedBy": "portal-admin"
      }
    }
  }
}
```

## Public Project PRs

These endpoints support public project metadata editing. The upstream API
validates project JSON with `@csc3213-2026-group-b/academic-domain-schemas`,
derives the target files, and then calls this service.

Project data lives in `GITHUB_PROJECTS_DATA_REPOSITORY` under
`public/projects`:

- Detail file: `public/projects/v2/projects/{slug}.json`.
- Aggregate listing: `public/projects/v2/projects.json`.
- Manifest: `public/projects/v2/manifest.json`.

### Read Public Project

Endpoint:

```http
GET /projects/public-project?slug=scholarship-management-system
X-Internal-Secret: your_internal_service_secret
```

Missing project files return `404` with `{"project": null}`.

### Read Public Project PR Status

Endpoint:

```http
GET /projects/public-project/pr?slug=scholarship-management-system
X-Internal-Secret: your_internal_service_secret
```

When no matching PR exists, the status is `none`.

### Create Or Update Public Project PR

Endpoint:

```http
PUT /projects/public-project/pr
Content-Type: application/json
X-Internal-Secret: your_internal_service_secret
```

Request body:

```json
{
  "slug": "scholarship-management-system",
  "updatedBy": "admin@sci.pdn.ac.lk",
  "updatedByType": "admin",
  "projectPath": "public/projects/v2/projects/scholarship-management-system.json",
  "aggregatePath": "public/projects/v2/projects.json",
  "manifestPath": "public/projects/v2/manifest.json",
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
        "role": "student"
      }
    ],
    "source": {
      "kind": "MANUAL",
      "curator": "SCS Projects Team"
    },
    "links": {},
    "media": {
      "icon": "FolderKanban"
    },
    "dates": {
      "lastUpdatedAt": "2026-07-24"
    }
  }
}
```

Behavior:

- Reuses an open `project/{slug}...` PR branch when one exists.
- Comments on a reused open PR with who updated the draft.
- Uses one stable `project/{slug}` branch per project.
- Replays each submitted edit on top of the latest default branch before
  writing files, so shared `projects.json` and `manifest.json` changes are
  regenerated from current data.
- Writes the project detail file as a single JSON object.
- Upserts the project into `public/projects/v2/projects.json`.
- Upserts the manifest entry into `public/projects/v2/manifest.json`.
- Opens a PR with `project-update` and `auto-merge-project` labels.
- Leaves the PR open for data-repository GitHub Actions to validate and merge.

When the user file does not exist, the service returns the default denied
configuration:

```json
{
  "proxy": {
    "active": false,
    "url": ""
  },
  "permissions": {
    "repo": {}
  }
}
```

## Update Proxy Settings

Endpoint:

```http
POST /user/proxy-settings
Content-Type: application/json
X-Internal-Secret: your_internal_service_secret
```

Request body:

```json
{
  "username": "github-user",
  "updatedBy": "verified-admin@example.com",
  "active": true,
  "url": "https://example.com/proxy"
}
```

Required fields:

- `username`: GitHub username, 1-39 characters, letters, numbers, and hyphen.
- `updatedBy`: verified actor supplied by the upstream API.
- `active`: boolean.
- `url`: absolute `http` or `https` URL.

Behavior:

- Writes `public/{username}.json`.
- Preserves the existing `permissions.repo` map when the file already
  exists.
- Sets `proxy.updatedAt` and `proxy.updatedBy`.
- Defaults `permissions.repo` to `{}` for new files.
- Includes the triggering actor, target user, timestamp, config file path, and
  before/after proxy values in the generated pull request body.

File shape:

```json
{
  "proxy": {
    "active": true,
    "url": "https://example.com/proxy",
    "updatedAt": "2026-07-08T10:00:00.000Z",
    "updatedBy": "portal-admin"
  },
  "permissions": {
    "repo": {
      "owner/repo-a": {
        "permission": "write",
        "updatedAt": "2026-07-08T10:00:00.000Z",
        "updatedBy": "portal-admin"
      },
      "owner/repo-b": {
        "permission": "admin",
        "updatedAt": "2026-07-08T10:05:00.000Z",
        "updatedBy": "portal-admin"
      }
    }
  }
}
```

Success response:

```json
{
  "success": true,
  "automation": {
    "branch": "automation/proxy/github-user/2026-07-08t05-01-22-123z-a1b2c3d4",
    "commitSha": "abc123...",
    "pullRequest": {
      "number": 12,
      "url": "https://github.com/org/repo/pull/12",
      "merged": true
    }
  }
}
```

Generated pull request body:

```text
Triggered by: portal-admin
Changed by: portal-admin
Changed for user: github-user
Changed at: 2026-07-08T10:00:00.000Z
Config file: public/github-user.json

Change type: proxy settings

Before:
- proxy.active: false
- proxy.url: none
- proxy.updatedAt: none
- proxy.updatedBy: none

After:
- proxy.active: true
- proxy.url: https://example.com/proxy
- proxy.updatedAt: 2026-07-08T10:00:00.000Z
- proxy.updatedBy: portal-admin
```

## Update Repository Permission

Endpoint:

```http
POST /user/repository-permission
Content-Type: application/json
X-Internal-Secret: your_internal_service_secret
```

Grant or update access:

```json
{
  "repository": "owner/repo",
  "username": "github-user",
  "permission": "write",
  "active": true,
  "updatedBy": "verified-admin@example.com"
}
```

Remove access:

```json
{
  "repository": "owner/repo",
  "username": "github-user",
  "active": false,
  "updatedBy": "verified-admin@example.com"
}
```

Required fields:

- `repository`: repository slug as `repo` or `owner/repo`.
- `username`: GitHub username, 1-39 characters, letters, numbers, and hyphen.
- `active`: boolean. Use `true` to grant and `false` to remove.
- `updatedBy`: verified actor supplied by the upstream API.

Optional fields:

- `permission`: one of `read`, `triage`, `write`, `maintain`, or `admin`. If
  omitted, `read` is used.

Behavior:

- Writes the same per-user file: `public/{username}.json`.
- Sets `permissions.repo[repository]` to an object with `permission`,
  `updatedAt`, and `updatedBy` when `active` is `true`.
- Removes `repository` from that user's `permissions.repo` map when `active` is
  `false`.
- Creates a default user config if the file does not exist yet.
- Preserves existing proxy fields while changing repository permissions.
- Includes the triggering actor, target user, repository, timestamp, config file
  path, and before/after permission values in the generated pull request body.

`permissions.repo` is the repository access map. A downstream proxy or org
access check should compare `permissions.repo[owner/repo].permission` with the
requested operation.

Success response has the same `automation` shape as
`POST /user/proxy-settings`.

Generated pull request body:

```text
Triggered by: portal-admin
Changed by: portal-admin
Changed for user: github-user
Changed at: 2026-07-08T10:00:00.000Z
Config file: public/github-user.json

Change type: repository permission
Action: grant
Repository: owner/repo
Requested permission: write

Before:
- permission: none
- updatedAt: none
- updatedBy: none

After:
- permission: write
- updatedAt: 2026-07-08T10:00:00.000Z
- updatedBy: portal-admin
```

## Public People Profile PRs

These endpoints support public profile editing through the Portal. The upstream
API validates profile JSON with
`@csc3213-2026-group-b/academic-domain-schemas`, derives all target files, and
then calls this service.

Profile data lives in `GITHUB_PEOPLE_DATA_REPOSITORY` under `public/people`.
Every profile has a fast lookup file plus one or more aggregate listing files:

- Staff: `public/people/v2/users/{username}.json` and one staff aggregate file.
- Students: `public/people/v2/users/{snumber}.json` and
  `public/people/v2/students/{batch}.json`.
- Honours students are still `profileKind: "student"` records. When
  `studentTrack` is `HONOURS`, the student files are written plus
  `public/people/v2/special/{special-name}/{batch}.json`.

### Read Public Profile

Endpoint:

```http
GET /people/public-profile?username=s21513
X-Internal-Secret: your_internal_service_secret
```

Success response:

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

Missing profile files return `404` with `{"profile": null}`.

### Read Public Profile PR Status

Endpoint:

```http
GET /people/public-profile/pr?username=s21513
X-Internal-Secret: your_internal_service_secret
```

Success response:

```json
{
  "status": "open",
  "number": 123,
  "url": "https://github.com/org/data.scs.pdn.ac.lk/pull/123",
  "branch": "profile/s21513-2026-07-15t12-00-00-000z",
  "canEdit": true
}
```

When no matching PR exists, the status is `none`.

### Create Or Update Public Profile PR

Endpoint:

```http
PUT /people/public-profile/pr
Content-Type: application/json
X-Internal-Secret: your_internal_service_secret
```

Request body:

```json
{
  "username": "s21513",
  "updatedBy": "s21513@sci.pdn.ac.lk",
  "updatedByType": "self",
  "profileKind": "student",
  "userPath": "public/people/v2/users/s21513.json",
  "aggregatePaths": [
    "public/people/v2/students/s21.json",
    "public/people/v2/special/computer-science/s21.json"
  ],
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

Behavior:

- Reuses an open `profile/{username}...` PR branch when one exists.
- Comments on a reused open PR with who updated the draft and whether it was a
  self edit or admin edit.
- Creates a new `profile/{username}-{timestamp}` branch when no open PR exists.
- Writes `userPath` as a single JSON object.
- Upserts the profile object into each aggregate array in `aggregatePaths`.
- Opens a PR with `profile-update` and `auto-merge-profile` labels.
- Leaves the PR open for data-repository GitHub Actions to validate and merge.

Success response:

```json
{
  "success": true,
  "pullRequest": {
    "status": "open",
    "number": 123,
    "url": "https://github.com/org/data.scs.pdn.ac.lk/pull/123",
    "branch": "profile/s21513-2026-07-15t12-00-00-000z",
    "canEdit": true
  }
}
```

## Failure Behavior

The service returns `400` for invalid JSON, missing fields, invalid usernames,
invalid repository slugs, invalid proxy URLs, or unsupported permissions. It
returns `401` when `X-Internal-Secret` is missing or wrong.

GitHub failures are surfaced as request failures. Common causes are invalid App
credentials, missing repository permissions, branch protection preventing
auto-merge, or merge conflicts with another generated automation branch.

Malformed existing user config is also surfaced as a request failure. This is
intentional so the service never overwrites an invalid access file with a
silently reduced permission set.
