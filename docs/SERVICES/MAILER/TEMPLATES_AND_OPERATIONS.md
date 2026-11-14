---
title: Mailer templates and operations
description: React Email rendering, email design constraints, adding templates, configuration, and production verification.
---

# Mailer templates and operations

Named templates make security-sensitive transactional mail an owned code path
instead of accepting markup from the browser. The current
`PortalSignInOtpEmail` is a React Email component rendered to both HTML and
plain text by `@react-email/render`.

## OTP template

The component includes:

- an English document and inbox preview;
- a clear SCS Portal sender context;
- a code-first subject (`{code} - Your SCS Portal login code`);
- the six-digit code once in selectable body text near its login label;
- the configured expiry in minutes and single-use guidance; and
- advice to ignore an unrequested message.

`email-theme.ts` owns the small email-specific palette. The component uses
React Email's pixel-based Tailwind preset because email clients need compiled,
portable styles; it does not depend on the web applications' runtime CSS or
theme state. `PreviewProps` supplies safe sample data for template previewing.

## HTML and plain text

`resolveMailMessage` renders the same component twice: normal rendering creates
the HTML document and `{ plainText: true }` creates the text alternative. A new
named template must preserve both forms. Do not make essential content depend
on remote images, custom fonts, client-side JavaScript, hover, or dark-mode
support.

For Portal login mail only, Nodemailer's native `otp` option adds one top-level
`OTP-Token` header with the same six-digit code and the origin of the Portal
request. The API accepts that origin only when it exactly matches its configured
trusted origins; the Mailer contract also requires a canonical HTTPS origin (or
an HTTP loopback origin for local development). Invalid values fail the send.
This header is based on an [Internet-Draft](https://datatracker.ietf.org/doc/draft-goto-otp-token/),
and Gmail has not documented that it enables Copy code. Remove the `otp` option
from `resolveMailMessage` to disable the experimental header without changing
the visible template or SMTP transport.

## Adding a template safely

1. Add a strict named-template variant to the Mailer request union in
   `@scs/schemas`, including bounded recipients and props.
2. Add the React Email component under `src/emails` with safe preview data.
3. Extend `resolveMailMessage` with an exhaustive template-name branch and an
   owned subject.
4. Add tests asserting meaningful content in HTML and plain text.
5. Add or change the API helper that is authorized to request the template.
6. Update [API contracts](../../API_CONTRACTS.md) and this guide in the same
   commit.

Do not accept a user-supplied template name, subject, or markup when the use
case can be represented by a bounded named template. Do not interpolate
unvalidated URLs or HTML into a component.

## Configuration

T3 Env validates configuration at startup. `MAILER_API_KEY` and `SMTP_HOST` are
required non-empty values; `SMTP_SECURE` accepts only `true` or `false`; `PORT`
is an integer from 1 through 65535. SMTP user and password have empty local
defaults and `SMTP_FROM` falls back to the user. The canonical inventory and
deployment ownership are in
[Environment variables](../../ENVIRONMENT_VARIABLES.md).

The Mailer is independently deployed. `vercel.json` selects Bun 1.x, while the
deployment adapter owns `VERCEL_EXPERIMENTAL_BACKENDS`; application code does
not read that value.

## Production verification

Use a non-production recipient and verify:

1. unauthorized requests are rejected;
2. the expected sender identity is provider-verified;
3. one OTP request returns `{ "ok": true }`;
4. the delivered HTML and text versions both contain the correct code and
   expiry;
5. the message renders legibly with images disabled; and
6. provider logs show acceptance without application logs exposing content.

For a manual Gmail check, send a test code only with operator authorization,
open the received message, choose **More → Show original**, and inspect the
top-level `OTP-Token` header and authentication results. Local MIME tests prove
only what Nodemailer composes; they cannot prove iCloud preserves the header or
that Gmail offers Copy code.

Source tests must not use real SMTP credentials. Record provider-side delivery
as a credential-dependent check, not as part of the unit-suite result.
