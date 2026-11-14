---
title: Shared package internals
description: Ownership, export, evolution, and verification guides for schemas, UI primitives, and repository tooling presets.
---

# Shared package internals

Packages centralize contracts or policy that genuinely cross deployable
boundaries. They do not turn the monorepo into one runtime: every application
and service remains independently deployable and consumes package exports at
build time.

| Package area                  | Shared responsibility                               | Must remain in a consumer                      |
| ----------------------------- | --------------------------------------------------- | ---------------------------------------------- |
| [Security](SECURITY/INDEX.md) | RFC 9116 document and discovery redirect policy     | report handling and application authorization  |
| [Schemas](SCHEMAS/INDEX.md)   | runtime domain and transport contracts              | private persistence and view state             |
| [UI](UI/INDEX.md)             | product-neutral primitives, hooks, and theme tokens | shells, cards, editors, and domain composition |
| [Tooling](TOOLING/INDEX.md)   | TypeScript and ESLint policy presets                | local files, aliases, runtime globals, ignores |

Other package guides are organized by the workflow they support:

| Package            | Canonical guide                                                       | Boundary                                                                |
| ------------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `@scs/identity`    | [Identity package](../PACKAGE_IDENTITY.md)                            | Pure account and Honours rules; the API owns decisions and persistence. |
| `@scs/moderation`  | [Public avatars](../PUBLIC_AVATARS.md#review-queue-and-audit-history) | Classification and policy; the API owns upload, review, and storage.    |
| `@scs/storage`     | [Binary object storage](../STORAGE.md)                                | Conditional binary writes; the API owns avatar pointers.                |
| `@scs/performance` | [Performance testing](../PERFORMANCE_TESTING.md)                      | Guarded local and authorized hosted load runs.                          |
| `@scs/webmcp`      | [Browser WebMCP](../WEBMCP.md)                                        | Browser tool registration and validation.                               |

Use direct package exports. Do not import a shared contract or primitive into a
local wrapper only to re-export it under the owning app or service.
