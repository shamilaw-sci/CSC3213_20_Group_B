# Configuration

All configuration is read from environment variables at startup (`src/config/env.ts`). The process exits immediately if `MAILER_API_KEY` is missing.

## Required

| Variable         | Description                                                     |
| ---------------- | --------------------------------------------------------------- |
| `MAILER_API_KEY` | Bearer token callers must present in the `Authorization` header |

## Optional (with defaults)

| Variable      | Default            | Description                                            |
| ------------- | ------------------ | ------------------------------------------------------ |
| `SMTP_HOST`   | `smtp.example.com` | SMTP server hostname                                   |
| `SMTP_PORT`   | `587`              | SMTP server port                                       |
| `SMTP_SECURE` | `false`            | Set to `"true"` for TLS-wrapped connections (port 465) |
| `SMTP_USER`   | `""`               | SMTP authentication username                           |
| `SMTP_PASS`   | `""`               | SMTP authentication password                           |
| `SMTP_FROM`   | `SMTP_USER`        | `From:` address on outgoing emails                     |
| `PORT`        | `3000`             | HTTP listen port                                       |

## `.env` example

```env
MAILER_API_KEY=change-me-to-a-random-secret

SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@mg.pdn.ac.lk
SMTP_PASS=your-smtp-password
SMTP_FROM=SCS Portal <noreply@pdn.ac.lk>

PORT=3000
```

## Customizing for Vercel Deployments

`VERCEL_EXPERIMENTAL_BACKENDS` should be set to `1` in the environment for deployments on Vercel. To know why, please read this changelog: [Experimental build mode for Hono and Express projects](https://vercel.com/changelog/experimental-build-mode-hono-express)
