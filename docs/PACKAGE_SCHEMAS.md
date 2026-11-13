---
title: Schemas package
description: Domain areas, exports, validation ownership, consumers, build output, and change workflow for packages/schemas.
---

# Schemas package

`packages/schemas` (`@scs/schemas`) is the direct source of shared runtime and
transport contracts. Identity review and Honours preview/apply request and
response shapes are validated here. The pure email classification, student role
lock, and range selection logic live in `@scs/identity`; the API owns
persistence and HTTP. It exports Zod schemas and inferred types from one package
entry point; consumers import from the package and must not re-export those
contracts through app-local wrappers.

## Domain areas

The package covers API editor/error/mutation/operation/pagination/proxy/mail
contracts, academic organizations and periods, courses and offerings, people
identifiers and staff/student records, research records, and projects including
types, status, people roles, links, media, dates, and course context.

Schemas validate data at trust boundaries: public JSON reads, HTTP requests and
responses, database/provider results, and persisted records. UI-only state,
framework configuration, and service-private implementation models do not
belong here.

## Change workflow

1. Determine whether the change is additive or a deliberate canonical data
   migration. Legacy compatibility is not automatic.
2. Update the owning schema and its package tests.
3. Import the new contract directly in every producer and consumer.
4. Update fixture/public data and transport docs in the same change.
5. Run package build, lint, both typechecks, and tests, then verify affected
   applications and services.

The build uses TypeScript plus `tsc-alias`; source package exports support
workspace development. See [Schemas](SCHEMAS.md) for deeper modeling rules and
the [schema reference](SCHEMA_REFERENCE/INDEX.md) for the complete visual
catalog.

## Distribution outside the monorepo

Monorepo workspaces import the private workspace package as `@scs/schemas`.
External repositories consume the compiled private GitHub Package
`@csc3213-2026-group-b/scs-schemas`; they do not need repository or submodule
access to this monorepo. The retired
`@csc3213-2026-group-b/academic-domain-schemas` package must not be used.

Every verified push to `main` that changes `packages/schemas/**` publishes a
new immutable version. The version is generated as
`0.<workflow run number>.<run attempt>`, and the artifact contains only the
prepared package metadata, compiled JavaScript, declarations, and license.
Consumers should pin an exact version and upgrade deliberately after a
successful publish rather than use a moving range.

The consuming repository must be granted **Manage Actions access** on the
package. Its workflow can then install with its short-lived `GITHUB_TOKEN` and
`packages: read`; no personal access token is stored in Actions. For a local
install, expose a GitHub token with `read:packages` only for the install:

```powershell tab="PowerShell" tab-group="terminal"
$env:NODE_AUTH_TOKEN = gh auth token
bun install
Remove-Item Env:NODE_AUTH_TOKEN
```

```bash tab="Bash" tab-group="terminal"
export NODE_AUTH_TOKEN="$(gh auth token)"
bun install
unset NODE_AUTH_TOKEN
```

```cmd tab="CMD" tab-group="terminal"
for /f "delims=" %i in ('gh auth token') do set "NODE_AUTH_TOKEN=%i"
bun install
set "NODE_AUTH_TOKEN="
```

The publishing and consumer security model, release checks, and troubleshooting
steps are maintained in the
[Schemas package internals](PACKAGES/SCHEMAS/INDEX.md) guide.

The [Schemas package internals](PACKAGES/SCHEMAS/INDEX.md) guide adds maintainer
detail on [ownership and exports](PACKAGES/SCHEMAS/OWNERSHIP_AND_EXPORTS.md) and
[contract evolution and verification](PACKAGES/SCHEMAS/EVOLUTION_AND_VERIFICATION.md).
