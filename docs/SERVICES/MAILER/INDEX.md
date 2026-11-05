---
title: Mailer internals
description: Source map, contract boundary, runtime ownership, and verification guide for transactional email delivery.
---

# Mailer internals

`services/mailer` is a Bun-hosted Hono service that accepts authenticated
transactional-email commands and delivers them through SMTP. It owns rendering
and delivery, while the API owns the event that decides an email should be
sent. It has no application database and is not a general browser-facing mail
relay.

## Source map

| Area          | Source                             | Responsibility                                                              |
| ------------- | ---------------------------------- | --------------------------------------------------------------------------- |
| Bun entry     | `src/index.ts`                     | starts the server using the validated port                                  |
| Hono app      | `src/app.ts`                       | static favicon, bearer guard, route mounting, not-found, and error policy   |
| Send route    | `src/routes/send.route.ts`         | JSON parsing, contract validation, delivery call, and HTTP status mapping   |
| Validation    | `src/validators/send.validator.ts` | applies the shared `MailerSendRequestSchema` at the boundary                |
| Delivery      | `src/services/mailer.service.ts`   | resolves raw or named-template content and uses the shared SMTP transporter |
| Templates     | `src/emails`                       | React Email components and email-only design tokens                         |
| Configuration | `src/config/env.ts`                | T3 Env parsing and sender fallback                                          |
| Contracts     | `@scs/schemas`                     | accepted request union and success/error response union                     |

## Supported request shapes

The shared schema accepts either:

- raw mail with one to 50 validated recipients, a non-empty subject, and at
  least one of HTML or text; or
- the named `portal-sign-in-otp` template with a six-digit code and an expiry
  from one to 60 minutes.

The current API uses only the named OTP request. Keeping the accepted union in
`@scs/schemas` makes both callers and Mailer compile against the same boundary.
Mailer imports that schema directly rather than re-exporting it through a
service-local contract file.

Detailed guides:

- [Delivery pipeline](DELIVERY_PIPELINE.md) covers authentication, validation,
  rendering, SMTP reuse, and response behavior.
- [Templates and operations](TEMPLATES_AND_OPERATIONS.md) covers React Email,
  plain-text output, configuration, safe extension, and delivery verification.

## Verification map

Tests prove shared-schema acceptance and named-template HTML/text rendering.
They stop before a real SMTP send. Provider authentication, sender
verification, mailbox delivery, and reputation remain deployment checks.

```bash
bun --filter '@scs/mailer' lint
bun --filter '@scs/mailer' typecheck
bun --filter '@scs/mailer' typecheck:test
bun --filter '@scs/mailer' test
bun --filter '@scs/mailer' knip
```

The workspace has no `build` script. Do not report a missing task as a passing
build; Vercel runs the Bun service through its deployment adapter.
