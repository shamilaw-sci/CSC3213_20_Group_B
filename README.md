# SCS PDN Monorepo

Websites and services for the Department of Statistics and Computer Science,
University of Peradeniya. The repository uses Bun workspaces and Turborepo,
but every application and service remains independently deployable.

## Start Here

Install the pinned Bun version shown in `.bun-version`, then run:

- Windows PowerShell:

  ```powershell
  git clone https://github.com/csc3213-2026-group-b/scs-pdn-monorepo.git
  Set-Location scs-pdn-monorepo
  bun install --frozen-lockfile
  bun --filter '@scs/web' dev
  ```

- macOS or Linux:

  ```bash
  git clone https://github.com/csc3213-2026-group-b/scs-pdn-monorepo.git
  cd scs-pdn-monorepo
  bun install --frozen-lockfile
  bun --filter '@scs/web' dev
  ```

- Windows Command Prompt:

  ```cmd
  git clone https://github.com/csc3213-2026-group-b/scs-pdn-monorepo.git
  cd /d scs-pdn-monorepo
  bun install --frozen-lockfile
  bun --filter '@scs/web' dev
  ```

Open the URL printed by Next.js. Most public applications can start with their
checked-in defaults. Portal, API, GitHub automation, and mail delivery need the
environment files described in
[Environment Variables](docs/ENVIRONMENT_VARIABLES.md).

## What Runs Where

This diagram shows the Cloudflare deployment. The optional
[departmental profile](docs/DEPARTMENTAL_DEPLOYMENT.md) runs the same apps and
services behind Caddy, with PostgreSQL for API and operation state and SeaweedFS
for private avatars.

```mermaid
flowchart LR
  Visitor[Browser] --> Web[Department website]
  Visitor --> People[People directory]
  Visitor --> Projects[Project directory]
  Maintainer[Maintainer or agent] --> Docs[Repository handbook]
  Member[Authenticated browser] --> Portal[Management portal]
  Portal --> API[API Worker]
  Web -->|personal-site lookup| API
  API --> State[(API D1: auth, proxy, and permission state)]
  API --> Avatars[(R2: public avatars)]
  API --> Mailer[Mailer]
  API --> Automation[GitHub App Worker]
  Automation --> Operations[(Durable Object SQLite: operations and leases)]
  Automation <--> Queue[Cloudflare Queue]
  Automation --> DataRepo[data repository]
  Web --> PublicData[Published public data]
  People --> PublicData
  People -->|public avatars| API
  Projects --> PublicData
```

Read [Architecture](docs/ARCHITECTURE.md) before changing a boundary between
workspaces.
Public People pictures use the separate [avatar API](docs/PUBLIC_AVATARS.md).

## Workspaces

| Path                     | Package              | Responsibility                                           |
| ------------------------ | -------------------- | -------------------------------------------------------- |
| `apps/web`               | `@scs/web`           | Department website                                       |
| `apps/docs`              | `@scs/docs`          | Repository handbook and agent-readable reference         |
| `apps/people`            | `@scs/people`        | Public staff, student, alumni, and profile pages         |
| `apps/projects`          | `@scs/projects`      | Public project discovery and project details             |
| `apps/portal`            | `@scs/portal`        | Authentication and management workflows                  |
| `services/api`           | `@scs/api`           | Browser-facing API, Better Auth, and state               |
| `services/github-app`    | `@scs/github-app`    | Durable Git-backed mutations and pull requests           |
| `services/mailer`        | `@scs/mailer`        | Authenticated templated email and SMTP delivery          |
| `packages/security`      | `@scs/security`      | Shared security.txt validation and generation            |
| `packages/moderation`    | `@scs/moderation`    | Provider-independent avatar moderation                   |
| `packages/storage`       | `@scs/storage`       | Binary object storage with conditional writes            |
| `packages/schemas`       | `@scs/schemas`       | Shared Zod and transport contracts                       |
| `packages/identity`      | `@scs/identity`      | Institutional classification and Honours selection rules |
| `packages/ui`            | `@scs/ui`            | Shared shadcn primitives and hooks                       |
| `packages/eslint-config` | `@scs/eslint-config` | Shared lint policy                                       |
| `packages/performance`   | `@scs/performance`   | Guarded load tests and local performance reports         |
| `packages/webmcp`        | `@scs/webmcp`        | Validated browser tool registration for WebMCP           |
| `packages/tsconfig`      | `@scs/tsconfig`      | Shared TypeScript presets                                |

The public data repository is a separate system. It is not a Bun workspace in
this repository.

## Daily Commands

```bash
# Run every declared development task.
bun run dev

# Run one workspace.
bun --filter '@scs/portal' dev
bun --filter '@scs/api' test

# Complete local quality gate.
bun run docs:check
bun run test:repo
bun run knip
bun run format:check
bun run lint
bun run typecheck
bun run typecheck:test
bun run test
bun run build
```

`typecheck` covers production source. `typecheck:test` covers test-only aliases,
fixtures, and runner globals. A workspace without a test script has no test
coverage; Turbo does not treat it as a passing suite.

## Handover Boundaries

The repository is production-oriented, but source control cannot prove or
replace external provider state:

- the public-data repository is deployed and validated separately;
- OAuth applications, Cloudflare bindings, queues, D1, SMTP, DNS, hosting
  projects, protected environments, and repository rulesets require operator
  access;
- root commands verify code but do not deploy every workspace as one release;
- production validation must record the deployed commit and any checks that
  require real credentials or provider consoles.

Use [Operations](docs/OPERATIONS.md) for deployment, migration, recovery, and
the remaining provider-side checks. Use
[Environment Variables](docs/ENVIRONMENT_VARIABLES.md) for the complete
configuration inventory.
The [departmental deployment guide](docs/DEPARTMENTAL_DEPLOYMENT.md) describes
the self-hosted Docker Compose profile and its staging verification boundary.
The [staging acceptance checklist](docs/STAGING_ACCEPTANCE.md) records the
evidence and recovery actions required before production sign-off.

## Repository Rules

- Use Bun only. The lockfile and `.bun-version` are authoritative.
- Keep deployables independent; do not make an unrelated app a runtime
  dependency.
- Put shared runtime contracts in `@scs/schemas` and reusable shadcn primitives
  in `@scs/ui`.
- Keep product-specific components inside their application.
- Parse environment variables in typed config modules; do not scatter
  `process.env` access or operational constants through components.
- Put tests under `test` or `tests`, following the owning workspace.
- Use `@/` or package aliases for cross-directory imports when the workspace
  supports them.
- Use Conventional Commits. Husky validates staged files and commit messages.
- Docker Compose is used for the optional self-hosted deployment profile; it
  does not replace the repository's Bun verification gate.

## Contributor Guidance

The [proposed AI usage policy](docs/AI_POLICY.md) covers human review,
confidentiality, attribution, and disclosure for AI-assisted contributions.
Automated contributors must also follow [AGENTS.md](AGENTS.md).

## AI Agent Skills

The repository shares one project-local skill set across compatible AI coding
agents. Approved skills are recorded in `skills-lock.json` and restored from
`.agents/skills/`, which is local and ignored. After cloning:

```bash
bunx skills experimental_install
bunx skills list
```

Use `bunx`, not `npx`, and do not install skills globally or per agent. See
[AI agent skills](docs/AI_AGENT_SKILLS.md) for the developer and maintainer
workflow. Skills do not affect runtime behavior.

## Documentation

| Guide                                                      | Read it when you need to…                                             |
| ---------------------------------------------------------- | --------------------------------------------------------------------- |
| [Repository handbook](docs/INDEX.md)                       | choose the right guide for a task                                     |
| [Repository overview](docs/REPOSITORY_OVERVIEW.md)         | map every workspace and its ownership boundary                        |
| [Development](docs/DEVELOPMENT.md)                         | set up the repository, make a change, or diagnose local tooling       |
| [Architecture](docs/ARCHITECTURE.md)                       | understand boundaries, data ownership, and request flows              |
| [Authentication](docs/AUTHENTICATION.md)                   | change sessions, OAuth, permissions, or service trust                 |
| [Public data](docs/PUBLIC_DATA.md)                         | understand published data reads and Git-backed writes                 |
| [Public data repository](docs/PUBLIC_DATA_REPOSITORY.md)   | validate and operate the separate public-data repository              |
| [API Contracts](docs/API_CONTRACTS.md)                     | call or change HTTP endpoints and durable operations                  |
| [Schemas](docs/SCHEMAS.md)                                 | add or evolve shared domain contracts                                 |
| [UI system](docs/UI_SYSTEM.md)                             | build consistent, accessible application interfaces                   |
| [Web application](docs/APPLICATION_WEB.md)                 | change department content, feeds, or redirects                        |
| [People application](docs/APPLICATION_PEOPLE.md)           | change directory browsing or profile interpretation                   |
| [Projects application](docs/APPLICATION_PROJECTS.md)       | change showcase discovery or project details                          |
| [Portal application](docs/APPLICATION_PORTAL.md)           | change authenticated editing and administration                       |
| [Application internals](docs/APPLICATIONS/INDEX.md)        | trace application routing, state, rendering, and failure behavior     |
| [API service](docs/SERVICE_API.md)                         | change browser API, auth, relational state, or orchestration          |
| [GitHub App service](docs/SERVICE_GITHUB_APP.md)           | change durable Git-backed automation                                  |
| [Mailer service](docs/SERVICE_MAILER.md)                   | change email templates, validation, or SMTP delivery                  |
| [Service internals](docs/SERVICES/INDEX.md)                | trace backend request lifecycles, state, integrations, and failures   |
| [Schemas package](docs/PACKAGE_SCHEMAS.md)                 | maintain, publish, and consume shared runtime and transport contracts |
| [Security package](docs/PACKAGE_SECURITY.md)               | maintain security.txt generation and discovery redirects              |
| [UI package](docs/PACKAGE_UI.md)                           | maintain shared shadcn primitives and theme tokens                    |
| [TypeScript config](docs/PACKAGE_TSCONFIG.md)              | change shared compiler policy                                         |
| [ESLint config](docs/PACKAGE_ESLINT_CONFIG.md)             | change shared lint and Tailwind policy                                |
| [Shared package internals](docs/PACKAGES/INDEX.md)         | maintain schema, UI, TypeScript, and ESLint package contracts         |
| [Testing](docs/TESTING.md)                                 | select and run the correct verification layers                        |
| [Departmental deployment](docs/DEPARTMENTAL_DEPLOYMENT.md) | install and operate the self-hosted Compose profile                   |
| [Performance testing](docs/PERFORMANCE_TESTING.md)         | configure safe k6/browser workloads and interpret capacity evidence   |
| [Dependency management](docs/DEPENDENCY_MANAGEMENT.md)     | add, update, audit, or remove dependencies                            |
| [AI agent skills](docs/AI_AGENT_SKILLS.md)                 | manage shared, project-local skills for compatible coding agents      |
| [Documentation authoring](docs/DOCUMENTATION_AUTHORING.md) | add or publish a handbook page                                        |
| [Environment Variables](docs/ENVIRONMENT_VARIABLES.md)     | configure local or deployed runtimes                                  |
| [Continuous Integration](docs/CI.md)                       | understand required checks and merge behavior                         |
| [Operations](docs/OPERATIONS.md)                           | deploy, migrate, observe, or recover a service                        |
| [Security](docs/SECURITY.md)                               | handle authentication, secrets, permissions, or incidents             |
| [UI quality assurance](docs/UI_QUALITY_ASSURANCE.md)       | review accessibility, responsiveness, themes, and interaction quality |
| [Browser WebMCP](docs/WEBMCP.md)                           | maintain browser tool registration and support limits                 |
| [Troubleshooting](docs/TROUBLESHOOTING.md)                 | diagnose common local, runtime, and provider failures                 |
| [Route reference](docs/ROUTE_REFERENCE.md)                 | find application and service route families                           |
| [Glossary](docs/GLOSSARY.md)                               | understand shared repository terminology                              |

Documentation is maintained with the code. Run `bun run docs:check` after
adding, renaming, linking, or removing a Markdown file.

## Getting Help

Start with the relevant guide and the nearest workspace `package.json`. When
reporting a problem, include the workspace, command, error output, commit SHA,
and whether the failure is local or from GitHub Actions. Report suspected
security issues privately as described in [Security Policy](SECURITY.md).
