# portal.scs.pdn.ac.lk

Authenticated portal for SCS PDN.

The portal is where users sign in, manage their account, submit public profile
updates, manage project registry entries, and access admin tools.

## What It Is For

- User sign-in and account settings.
- Public profile editing.
- Project registry editing.
- Academic course management.
- Admin user, proxy, action, and project screens.

## How It Fits

The portal talks to the API for protected operations. Public profile and project
changes become GitHub pull requests before they are published to the public data
service.

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

Local settings can be placed in `.env.local`.
