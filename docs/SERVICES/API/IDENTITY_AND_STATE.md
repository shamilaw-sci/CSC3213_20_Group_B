---
title: API identity and state
description: Better Auth policy, D1 tables, permission resolution, proxy state, and administrative safety invariants.
---

# API identity and state

The API has two related identity layers. Better Auth proves the browser
session; the `permission` table determines what that verified identity may do.
Neither provider profile data nor a session cookie alone grants an application
role.

## Authentication configuration

`createAuth` constructs Better Auth per request so it can use request-scoped
bindings, origin-derived passkey settings, and Cloudflare background tasks. It
configures:

- Google and GitHub OAuth;
- email sign-in OTPs delivered by Mailer;
- passkeys whose registration requires a session;
- encrypted OAuth tokens and database-backed OAuth state;
- hashed verification identifiers and OTP values;
- database-backed global and OTP-specific rate limits;
- secure cross-subdomain cookies in HTTPS deployments; and
- restricted account linking that requires a verified local email and does not
  allow different-email linking.

New identities must use an allowed University of Peradeniya email domain. A
linked GitHub sign-in is deliberately exempt from re-qualifying the identity
against GitHub's returned primary email, because that provider email must not
replace the established university identity.

## Session resolution

Protected handlers resolve the Better Auth session from the request cookies,
lowercase the email, then read its permission record. Missing records produce
`404`, blacklisted records produce `403`, and invalid or expired sessions
produce `401`. The normalized application role and access level are derived
from the permission record, not accepted from the browser.

An `X-Client-Id` is required where the session verifier is used. It identifies
an allowed first-party client; it is not a credential and does not replace the
session.

## D1 ownership

Migrations are append-only and currently create four state groups:

| Migration                           | Owned state                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| `0001_better_auth.sql`              | users, sessions, provider accounts, verification records, passkeys, and rate limits |
| `0002_auth_identity_uniqueness.sql` | unique provider-account and passkey credential identities                           |
| `0003_proxy_settings.sql`           | per-user proxy destination, attempt budget/window, audit fields, and revision       |
| `0004_permissions.sql`              | normalized role/access fields plus the complete JSON permission record              |

The relational role and access columns support filtering and constraints; the
JSON column preserves the complete application permission shape. Repository
functions normalize stored values before exposing them.

## Permission invariants

- Roles describe a person's domain relationship; access levels grant
  administrative capability. Do not infer one from the other.
- A newly created Better Auth user receives a permission record only when one
  does not already exist. The default role is derived from the verified email
  policy and the default access level is `NONE`.
- Administrative updates normalize patches before persistence.
- The service protects the last super-admin boundary when updating or deleting
  permission records.
- Notification preferences are stored through the permissions repository;
  they are not auth-provider settings.

## Proxy settings

Proxy settings are D1 application state, not public-data records. Each email
has a stable username, active flag, URL, bounded remaining attempts, reset
window, audit identity, and monotonically updated revision. The service checks
the current session, target eligibility, administrator requirements, and
attempt budget before saving. Admin list routes use bounded cursor pagination.

## Safe schema changes

Add a new numbered migration; never rewrite an applied migration. Update the
repository mapping, environment/provider instructions when bindings change,
and characterization tests that prove old and new rows are interpreted
correctly. Deployment and rollback boundaries are documented in
[Operations](../../OPERATIONS.md).
