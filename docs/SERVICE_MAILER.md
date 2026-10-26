---
title: Mailer service
description: Authenticated send route, React Email templates, validation, SMTP configuration, and verification.
---

# Mailer service

`services/mailer` (`@scs/mailer`) is a small Bun-hosted Hono service. It accepts
authenticated transactional-mail requests from the API, renders supported
React Email templates, and delivers them through SMTP.

## Request path

`POST /send` is protected by bearer authentication using `MAILER_API_KEY`. The
route validates the shared `MailerSendRequest` contract, the service selects an
owned template such as the one-time-code email, React Email renders accessible
HTML and text, and Nodemailer sends with configured SMTP credentials. Unknown
routes and failures return the shared response shape without leaking provider
details.

Configuration is parsed in `src/config`; templates live in `src/emails`, route
composition in `src/routes`, delivery in `src/services`, and boundary schemas in
`src/validators` only when they are service-local. Shared transport schemas are
imported directly from `@scs/schemas`.

## Change and verify

Keep templates usable without remote images, include a text alternative, and
avoid logging codes or recipient-sensitive content. Validate the request before
rendering or opening SMTP. Run the declared `check` command or its component
lint, production/test typechecks, tests, and Knip scripts. A real SMTP send is a
credential-dependent deployment check, not part of the local unit suite.
