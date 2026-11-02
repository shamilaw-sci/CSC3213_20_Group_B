---
title: Portal data loading and failures
description: Server data aggregation, API request behavior, nullable records, pagination, loading states, and error routing.
---

# Portal data loading and failures

Portal pages prefer server-side loading for identity and initial editor data,
then hand bounded initial state to interactive client components. All browser
and server requests still go through `services/api`; Portal does not read D1 or
private GitHub automation directly.

## Server API client

`src/lib/server/api-client.ts` is marked `server-only`. It serializes the
incoming request cookies, adds the configured `X-Client-Id`, disables fetch
caching, and centralizes response behavior:

| Response               | Portal behavior                                        |
| ---------------------- | ------------------------------------------------------ |
| `2xx`                  | parse the expected JSON payload                        |
| `401`                  | redirect through `/logout` to clear stale cookies      |
| `403`                  | redirect to `/dashboard`                               |
| `404` on optional read | return `null` when the loader permits a missing record |
| other failure          | parse the API error and throw `PortalApiError`         |

The generic type parameter describes the expected payload but does not validate
untrusted JSON at runtime. Boundary validation belongs to the API. Client-side
editors validate drafts with the owning shared schema before submission.

## Parallel page loaders

Editor loaders request independent prerequisites concurrently:

- public-profile loading combines the applicable profile schema, current or
  target profile, and pull-request status;
- project loading combines the current user, field permissions, optional
  project, courses, and offerings;
- course loading combines the current user, field permissions, optional
  course, optional pull request, and offerings.

After parallel loading, dynamic course and project detail loaders call
`notFound()` when their primary record is absent. Admin user detail, edit,
profile, and settings routes all validate the selected user through the shared
user loader, which also calls `notFound()` for confirmed absence instead of
redirecting to the list. Nested course, project, and admin-user not-found files
preserve entity-specific recovery links. Other API failures still throw. This
avoids request waterfalls while preserving a real HTML `404`. Lists use
cursor-based page endpoints with explicit limits rather than loading an
unbounded collection.

## User-visible pending and failure states

Route-level `loading.tsx` files provide skeletons shaped for the owning page.
They should preserve the page's main geometry and must not imply that a record
exists before the request finishes. App-level error, global-error, not-found,
and global-not-found files cover failures at their corresponding Next.js
boundaries.

Keep these states distinct in editor UI:

- **published** describes the current public repository record;
- **draft** describes local working data;
- **submitting** means a request or operation is in progress;
- **succeeded** means the durable operation completed successfully;
- **failed** means a terminal operation or request failed.

Never label an accepted or queued operation as published. When a nullable read
returns no record, render the relevant creation or unavailable state; do not
convert unrelated transport failures into `null`.
