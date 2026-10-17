# SCS PDN API

Backend API for the SCS PDN portal and related services.

The API handles sign-in, sessions, permissions, protected portal data, and the
server-side checks needed before public profile or project changes become pull
requests.

## What It Is For

- User authentication and session handling.
- Role and permission checks.
- Portal account, proxy, profile, and admin operations.
- Validating public profile and project submissions.
- Calling internal automation services when repository-backed data must change.

## Related Services

- Portal frontend: `portal.scs-pdn.space`
- Public data: `data.scs-pdn.space`
- GitHub automation: `scs-portal-github-app`
- Mail delivery: `mailer.scs.pdn.ac.lk`

## Development

```sh
bun install
bun run dev
```

Useful checks:

```sh
bun run typecheck
bun run lint
bun test
bun run build
```

Detailed endpoint documentation is in [docs/api-reference.md](docs/api-reference.md).
