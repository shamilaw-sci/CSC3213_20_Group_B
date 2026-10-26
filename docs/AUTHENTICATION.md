---
title: Authentication and authorization
description: Better Auth, OAuth, sessions, role checks, internal service authentication, and trust boundaries.
---

# Authentication and authorization

`services/api` owns user authentication and authorization. `apps/portal` is the
browser client. Public applications do not require a session to read published
data.

## User authentication

Better Auth runs in the API Worker and persists its state in the `AUTH_DB` D1
binding. Google and GitHub OAuth are configured server-side. The Portal calls
the API origin configured by `NEXT_PUBLIC_BASE_API_URL`; it does not handle
provider client secrets.

Sessions identify a user, but identity alone is not authorization. API route
handlers enforce the permission required for profile, project, academic, proxy,
or administrative actions. Admin interfaces must remain protected at the API
boundary even when the Portal also hides unavailable actions.

## Service authentication

The API authenticates requests to the mailer with `MAILER_API_KEY` and requests
to the GitHub App with `GITHUB_APP_INTERNAL_SECRET`. The GitHub App receives
trusted actor headers only from that authenticated service boundary. Never call
private automation routes from browser code or expose these credentials through
`NEXT_PUBLIC_*` variables.

## Change checklist

1. Update the shared request/response schema in `@scs/schemas` when a contract
   changes.
2. Enforce the permission in the API handler, not only in UI navigation.
3. Test unauthenticated, authenticated-but-forbidden, and permitted cases.
4. Review cookie, CORS, redirect-origin, and OAuth callback behavior together.
5. Update [Environment variables](ENVIRONMENT_VARIABLES.md) and
   [Security](SECURITY.md) when credentials or trust boundaries change.

Do not log session tokens, OAuth secrets, internal bearer tokens, or submitted
one-time codes. See [API contracts](API_CONTRACTS.md) for endpoint behavior.
