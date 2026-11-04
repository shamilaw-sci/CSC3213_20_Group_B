---
title: Public profile avatars
description: Public People avatar storage, moderation, and migration operations.
---

# Public profile avatars

People public profile JSON has no image URL or avatar metadata. Public profile edits
continue through the GitHub App PR workflow. Avatar writes use the API Worker and
never change GitHub profile data or Portal private profile records.

## Worker resources

Enable R2 on the Cloudflare account, create one Standard bucket named
`scs-profile-pictures`, and apply the API Worker configuration. The native
`PROFILE_PICTURES` R2 binding stores immutable WebP objects and `current.json`
pointers in the same bucket. The `IMAGES` binding decodes, resizes, and
re-encodes upload bytes. Apply `0006_public_avatar_rate.sql` to the API D1
database before deployment. Set the Worker secret `TYPESAFE_API_KEY` to a TypeSafe
API key. No S3 credentials or second metadata database are used.

The API requires a published public profile whose email matches the signed-in
member. Owners can `POST` one multipart field named `image` to
`/api/people/v2/avatars/me` (JPEG, PNG, WebP, at most 4 MiB), `GET` that route
for their canonical identity and current URL, or `DELETE` it. Public `GET` and
`HEAD` requests use `/api/people/v2/avatars/:username` and
`/api/people/v2/avatars/:username/:sha256.webp`. Missing images return 404.
The mutable URL redirects to the active content-addressed URL. All public image
responses use `Cache-Control: no-store`, including versioned URLs, because
deletion and moderation revocation must take effect without cross-region cache
purging. The immutable objects remain private in R2 and version reads are
authorized against the current pointer. The service does not claim a transaction
across image and pointer writes; an interrupted or conflicted write may leave an
unreferenced private object, which must be cleaned up only after checking all
current pointers. Pointer changes use R2 ETag conditional writes and concurrent
updates return 409. Uploads are limited to six attempts per owner per hour.

The Worker verifies magic bytes, checks for PNG and WebP animation, uses the
Images binding to decode, bounds dimensions and pixel count, and re-encodes a
512 by 512 WebP without source metadata. It sends a JPEG rendering of the same
image to Jev `jev-latest` with `TypeSafe-Danger-Zone-Images: true`. Separate
Choice questions classify safety and single-person portrait suitability in one
request. A high-confidence unsafe or unsuitable choice is rejected; uncertain,
low-confidence, malformed, timed-out, or unavailable moderation is held and
never published. No review queue exists yet, so `review_required` asks the user
to retry or contact an administrator. Jev image support is experimental; its
accuracy, latency, and production reliability require live evaluation before
opening uploads widely.
The official JavaScript SDK documents Node.js 22+ and optional zstd compression.
The Worker therefore uses the documented typed multipart HTTP endpoint directly,
without a Node-specific dependency or a text-only gateway.

TypeSafe's image limits currently require still PNG or JPEG, 280–1568 pixels
per side, and at most 16 MiB per image; the Worker sends a 512-pixel JPEG.
The [image documentation](https://docs.typesafe.ai/images) calls this feature
experimental. The [November 2026 price](https://help.typesafe.ai/articles/5187202169-how-much-does-jev-cost)
is $0.042 per million input tokens with output tokens free. The default account
rate limits are 100,000 tokens and 80 requests per second. These provider values
can change; the Worker enforces its own six-attempt hourly owner limit and a
15-second moderation timeout.

## Existing image migration

The sole legacy public image belongs to `s21513`. Its source remains recorded in
`services/api/scripts/import-public-avatar.ts` for an idempotent owner-authorized
import. After R2 and Jev are available, sign in as that public profile owner,
set `AVATAR_MIGRATION_SESSION_COOKIE` in the local process environment, and run:

```powershell
bun --filter '@scs/api' avatar:import
```

The script checks the authenticated username and skips an existing approved
avatar. It reports failures with the username. As of 2026-11-04, the source
returns HTTP 200 (`image/jpeg`, 117,948 bytes). A live Jev call with this image
returned `approved`, and `TYPESAFE_API_KEY` is configured as an API Worker secret.
R2 was then enabled on the university Cloudflare account. The private Standard
bucket was created in APAC, the D1 rate-limit migration applied, and the API
Worker deployed with its R2 and Images bindings. The authenticated owner GET
returned `{"username":"s21513","url":null}`. The import has **not** run yet;
the source field is removed from the pending public data change and the profile
will display initials until import succeeds. Never describe this image as
migrated before confirming the new API URL serves it.
