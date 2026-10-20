# Security

## Trust Boundaries

- Browsers are untrusted clients of `services/api`.
- `services/api` is the only browser-facing caller of private GitHub App
  routes.
- `services/github-app` is trusted to create controlled changes in configured
  repositories but must still validate every request.
- Public data is untrusted until parsed with the applicable schema.
- SMTP, OAuth providers, GitHub, KV, and deployment platforms are external
  systems whose errors and responses require validation.

## Secrets

Secrets belong in deployment secret stores and ignored local environment
files. Never track:

- OAuth client secrets;
- JWT or signing secrets;
- GitHub App private keys;
- internal service secrets;
- SMTP passwords or mailer API keys;
- access tokens or populated environment files.

A secret removed from Git history must still be rotated. Deletion alone does
not make it safe.

## Authentication and Authorization

- Better Auth state is stored in D1. Verification identifiers and email OTPs
  are hashed, rate-limit counters are durable, and OAuth tokens are encrypted
  at rest with `BETTER_AUTH_SECRET`.
- Better Auth keeps CSRF and origin validation enabled and accepts only the
  explicitly configured Portal origins. OAuth accounts are never implicitly
  linked by matching email; linking requires an authenticated user action.
- Passkey registration requires an authenticated session, user verification,
  an allowed origin, and the origin-specific relying-party ID.
- Email/password authentication is not enabled. Better Auth owns passwordless
  email OTP, passkey, Google, and GitHub flows. Implicit email-based account
  linking stays disabled.
- Better Auth sessions are verified on every protected request. The current
  permission record is also checked so blacklisting takes effect immediately.
- Administrative routes require the appropriate role at the time of action.
- Mutation authorization is checked independently of client-visible UI state.
- Internal GitHub App requests require service authentication; the browser
  never receives the internal secret.
- Secret comparisons should be constant-time where platform identity is not
  available.
- OAuth state and redirect targets must be bound and validated.
- Passkey challenges must be short-lived and tied to the configured origin and
  relying party.

Legacy JWT, magic-code KV, token-blacklist KV, custom OAuth, and custom
WebAuthn routes are removed. A super-admin-only, confirmation-gated action
migrates existing GitHub identities and passkeys into D1 and removes the old
auth fields from permission records. Normal requests never read those legacy
fields. Remove the migration action after production migration and review are
complete.

## Input and Output

Parse external JSON with Zod schemas and reject unknown path shapes before
constructing repository paths or URLs. Validate branch names, entity IDs,
cursors, operation IDs, and redirect targets.

Return stable, bounded error codes and messages. Provider error objects, stack
traces, private records, credentials, and repository tokens do not belong in
client responses.

## GitHub Automation

- Use installation tokens with minimum repository permissions.
- Do not force-push after a stale reference failure.
- Bind a mutation to an expected entity revision and surface `409 Conflict`
  when it changed.
- Make retries idempotent before enabling queue redelivery.
- Treat PR labels and branch prefixes as signals, not sufficient authorization
  on their own.
- Validate the repository, base branch, head repository, operation metadata,
  and current actor permissions before destructive or merge actions.
- Never run untrusted pull-request code with write credentials.

## Logging and Audit

Use correlation and operation IDs. Log bounded categories, durations, attempt
numbers, resource identities, and provider request IDs. Redact tokens, cookie
values, private keys, OAuth payloads, complete private profiles, and email
contents.

GitHub PR bodies and comments provide an audit trail but must not contain
secrets. Structured operation state is authoritative; prose comments are not a
secure database.

## Reporting and Response

Report vulnerabilities privately to the repository maintainers. For a
suspected exposure:

1. stop further publication of the value;
2. rotate or revoke it at the provider;
3. update deployment stores;
4. invalidate related sessions or tokens;
5. inspect logs and repository history for use;
6. document the remediation without reproducing the secret.
