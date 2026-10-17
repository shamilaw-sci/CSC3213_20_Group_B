# people.scs.pdn.ac.lk

Public people directory for the Department of Statistics and Computer Science,
University of Peradeniya.

The site lets visitors browse staff and students, open public profiles, and
find department contact information. It reads published JSON from the SCS public
data service.

## What It Is For

- Staff directory pages.
- Student batch and subject pages.
- Public profile pages.
- Search-engine friendly public people content.

## Data Source

Profile data is published from `data.scs.pdn.ac.lk` and served from:

```text
https://data.scs-pdn.space/people/v2
```

Profile editing happens in the portal, not on this public site.

## Development

```sh
bun install
bun run dev
```

Useful checks:

```sh
bun run lint
bun run build
```
