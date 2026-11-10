---
title: Binary object storage
description: Avatar object drivers, conditional writes, and provider migration.
---

# Binary object storage

`@scs/storage` stores binary objects by key. Its `BinaryObjectStore` contract
provides `get` (a Web `ReadableStream`), `head`, `put`, and `delete`, with content
type and custom metadata. `put` accepts bytes, text, or a Web stream. A `put`
condition is either `create` (the key must be absent) or `match` (its current
ETag must equal the supplied ETag). A failed condition returns `null`; transport
and storage failures throw. Never turn a conditional write into a separate read
followed by an unconditional write.

The package exports separate entry points for `r2`, `s3`, and `fs`. The Worker
imports only `r2` and `s3`; Node filesystem modules stay out of its bundle.
Driver configuration is checked with `StorageDriverConfigSchema`. Callers can
inject a `BinaryObjectStore`, including in tests. This package does not own D1,
Durable Objects, GitHub repositories, or Queues.

## Drivers and guarantees

| Driver     | Host               | Conditional create and ETag replacement                   | Notes                                                                                                                                                                                                   |
| ---------- | ------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native R2  | Cloudflare Worker  | Atomic `R2Bucket.put` `onlyIf`                            | The current API default; returns `null` on a failed condition.                                                                                                                                          |
| S3 API     | Worker or Node/Bun | Server-side `PutObject` `If-None-Match: *` and `If-Match` | A one-time concurrent-write probe runs before the first conditional write and fails closed if competing writes succeed. A live provider was not available for this change.                              |
| Filesystem | Node/Bun           | Per-key atomic directory lock plus temporary-file rename  | Coordinates instances sharing one local filesystem. Do not use on NFS or another filesystem without atomic `mkdir` and replace-by-rename semantics. A stale lock fails explicitly after a bounded wait. |

Native R2 and Cloudflare R2's S3 API document atomic conditional writes. Amazon
S3 supports both `PutObject` conditions; current MinIO documents them too.
Other S3-compatible services may ignore or reject the headers. The driver
probes both conditions with a random key under `__scs_storage_probe__/` and
deletes it afterward. Grant delete permission for that key. If the provider
cannot establish both guarantees, it is unsupported for avatar pointers. An
unexpected provider response or missing ETag fails explicitly. Run a fresh
live probe after a provider upgrade; the driver caches its result for the
lifetime of one instance.

`unstorage` has useful raw binary drivers, but its common interface does not
offer the required atomic compare-and-swap operation. The AWS S3 client is used
only for S3 signing and operations. The native R2 and filesystem drivers use no
additional runtime library.

## API Worker configuration

The API defaults to `AVATAR_STORAGE_DRIVER=r2` and uses the existing
`PROFILE_PICTURES` binding and bucket. No change to production configuration is
needed for that default. For S3, set `AVATAR_STORAGE_DRIVER=s3`,
`AVATAR_S3_BUCKET`, `AVATAR_S3_REGION`, and `AVATAR_S3_ENDPOINT`; supply
`AVATAR_S3_ACCESS_KEY_ID` and `AVATAR_S3_SECRET_ACCESS_KEY` as Worker secrets.
The S3 client uses path-style addressing. For Cloudflare R2's S3 API, the
endpoint is `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` and the region is
`auto`. MinIO needs its endpoint, bucket, credentials, and an appropriate region.
Grant object read, write, and delete permissions. Keep the bucket private and
serve images only through the API's authorization and no-store responses.

The filesystem driver takes `{ driver: 'fs', root: '/absolute/private/path' }`
through `createFileStore`. It needs a writable private local directory and a
Node/Bun process. The Cloudflare API Worker cannot select it by environment
variable because Workers have no local filesystem. A Node-hosted consumer can
inject the resulting store into `AVATAR_STORAGE`; use that only in a runtime
that can host the existing API dependencies. Files under this root are encoded
by the driver; do not edit them by hand. The root must be on a trusted local
filesystem, accessible only to the application process.

## Avatar keys and provider migration

The avatar service still writes `avatars/<username>/<sha256>.webp` and
`avatars/<username>/current.json` in the same private bucket or store. Pending
review images use the same content-addressed object keys. The pointer format,
moderation, D1 review and audit state, HTTP routes, cache policy, and quota are
unchanged. A provider switch changes the storage namespace; it does **not**
copy existing objects. Switching without copying makes existing avatars and
pending review images unavailable.

To migrate, stop avatar writes and review decisions, inventory all avatar
objects in the source, and copy bytes and content types to the destination
under identical keys. Copy private pending images and all `current.json`
pointers, including tombstones. Verify counts, SHA-256 of WebP bytes, pointer
JSON, and that every active pointer and pending D1 review references an existing
destination object. Do not assume source ETags are portable: the destination
assigns its own ETags, and later pointer reads use those destination ETags.
Run a concurrent conditional-write probe on the destination. Change Worker
configuration only after verification, test public GET/HEAD and owner/admin
review paths, then reopen writes. Keep the source private and available for
rollback until the destination has been validated. A rollback after new writes
requires a reverse copy or an explicit freeze; changing the driver alone cannot
reconcile diverged stores.

Sources: [R2 Worker conditions](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/),
[R2 S3 atomic conditions](https://developers.cloudflare.com/r2/api/s3/extensions/),
[Amazon S3 conditional writes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html),
[MinIO S3 compatibility](https://docs.min.io/aistor/developers/s3-api-compatibility/),
[unstorage drivers](https://unstorage.unjs.io/drivers).
