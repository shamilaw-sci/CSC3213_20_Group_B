# SCS Portal GitHub App

Internal automation service for repository-backed SCS PDN changes.

The GitHub App creates and updates pull requests when the portal needs to
change public data or configuration repositories.

## What It Is For

- Public profile update pull requests.
- Project registry update pull requests.
- Proxy configuration pull requests.
- GitHub branch, commit, label, and PR automation.

## How It Fits

The portal sends protected requests to the API. The API verifies the user and
calls this service. This service writes to the target repository and opens or
updates the pull request.

## Development

```sh
bun install
cp .env.example .env
bun run dev
```

Useful checks:

```sh
bun run typecheck
bun run lint
bun run build
```

Detailed automation notes are in
[docs/github-app-automation.md](docs/github-app-automation.md).
