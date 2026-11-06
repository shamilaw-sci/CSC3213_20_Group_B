---
title: Public profile avatars
description: Public People avatar storage, moderation, and operations.
---

# Public profile avatars

People public profile JSON has no image URL or avatar metadata. Public profile edits
continue through the GitHub App PR workflow. Avatar writes use the API Worker and
never change GitHub profile data or Portal private profile records.
Owners upload, replace, and remove their picture at
`/user/me/public-avatar` in Portal. People profile pages display the approved
picture.

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

The authenticated `GET /api/people/v2/avatars/me` response includes the current
canonical identity, published URL, and a `quota` object with `limit`, `used`,
`remaining`, `windowStartedAt`, `resetsAt`, `retryAfterSeconds`, and `available`.
Reading the quota never consumes an attempt. `POST` consumes one attempt before
it parses or validates the multipart body, so malformed files, oversize images,
validation failures, moderation rejections, and service failures all count
toward the hourly window. Successful uploads, validation errors, moderation
errors, and 429 responses include the refreshed quota; 429 also sets
`Retry-After`. `DELETE` does not consume an attempt. Windows start on fixed UTC
hour boundaries. Stored attempts are capped at six when reported so the UI never
shows more than the permitted limit.

The Worker verifies magic bytes, checks for PNG and WebP animation, uses the
Images binding to decode, bounds dimensions and pixel count, and re-encodes a
512 by 512 WebP without source metadata. It sends a JPEG rendering of the same
image to Jev `jev-latest` with `TypeSafe-Danger-Zone-Images: true`. Separate
Choice questions classify safety and single-person portrait suitability in one
request. A high-confidence unsafe or unsuitable choice is rejected; uncertain,
low-confidence, malformed, timed-out, or unavailable moderation is held and
never published. The API returns structured moderation metadata with a `status`
of `approved`, `rejected`, `review_required`, or `unavailable`, a stable code,
a user-facing message, and per-check outcomes for safety and portrait
suitability. It does not expose raw model probabilities, confidence values, or
provider payloads. Policy rejections use HTTP 422. Review-required and
unavailable checks use HTTP 503; `unavailable` identifies a technical failure
such as a timeout, missing credential, HTTP error, or malformed provider
response and is not a policy rejection. No review queue exists yet, so
`review_required` asks the user to retry or contact an administrator. Jev image
support is experimental; its accuracy, latency, and production reliability
require live evaluation before opening uploads widely.
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
