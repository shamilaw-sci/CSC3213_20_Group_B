---
title: Repository overview
description: A practical map of the deployable applications, services, shared packages, data sources, and ownership boundaries.
---

# Repository overview

This Bun and Turborepo monorepo contains the software operated for the
Department of Statistics and Computer Science. Each application and service is
independently deployable; the root task graph coordinates development and
verification but is not a combined runtime.

## Workspace map

| Area                   | Workspaces                                                                       | Purpose                                                              |
| ---------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Public applications    | `apps/web`, `apps/people`, `apps/projects`                                       | Department content and public data discovery                         |
| Management application | `apps/portal`                                                                    | Authenticated profile, project, course, and administration workflows |
| Documentation          | `apps/docs`                                                                      | This handbook, search, and machine-readable documentation            |
| Edge services          | `services/api`, `services/github-app`                                            | Browser API, auth/state, and durable GitHub-backed mutations         |
| Bun service            | `services/mailer`                                                                | Authenticated React Email rendering and SMTP delivery                |
| Shared policy          | `packages/schemas`, `packages/ui`, `packages/eslint-config`, `packages/tsconfig` | Contracts, primitives, and tool configuration                        |

The separately deployed public-data repository is not a workspace. Public apps
read its published JSON. Mutations travel from Portal to API to GitHub App and
become reviewed Git changes; browser code never receives GitHub App secrets.

## Where to make a change

- Change a domain or transport shape in `packages/schemas` first, then update
  producers and consumers directly.
- Change a reusable shadcn primitive in `packages/ui`; keep product composition
  in the owning app.
- Change authentication, permissions, or browser-facing orchestration in
  `services/api`.
- Change durable repository mutations or pull-request automation in
  `services/github-app`.
- Change delivery and templates in `services/mailer`.

Read [Architecture](ARCHITECTURE.md) for flows and ownership, then open the
workspace guide listed in this handbook. Commands and completion gates live in
[Development](DEVELOPMENT.md) and [Testing](TESTING.md).

## Supported toolchain

The checked-in `.bun-version`, root `package.json`, and `bun.lock` are
authoritative. Use Bun for installation and scripts. Root commands run through
Turborepo; workspace commands use `bun --filter '<package>' <script>`.
