# SCS Mailer API

Transactional email service for SCS PDN.

The mailer sends system emails such as portal sign-in messages. It is a small
Bun service that receives internal requests, validates them, and sends email
through SMTP.

## What It Is For

- Magic-code sign-in emails.
- Transactional portal email delivery.
- Central SMTP configuration for SCS PDN services.

## Development

```sh
bun install
cp .env.example .env
bun run dev
```

Useful checks:

```sh
bun run typecheck
bun run check
```

More details are in the [docs](docs) folder.
