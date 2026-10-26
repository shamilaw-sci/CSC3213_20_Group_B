---
title: Documentation site design
description: Approved source ownership, information architecture, and publishing design for the handbook.
---

# Documentation Site Design

## Intent

Create an independently deployable Fumadocs site that explains the complete
SCS PDN monorepo to contributors, maintainers, operators, and automated agents.
The existing files under `docs/` remain ordinary Markdown that can be read and
edited locally or on GitHub. Those same files are the site's content source so
there is no generated or manually maintained second copy.

The site is public technical documentation. It may describe security and
operational boundaries, configuration names, recovery procedures, and failure
modes, but it must never publish credential values, private incident material,
or instructions that weaken an authorization boundary.

## Goals

- Add `apps/docs` as a Bun workspace and independently deployable Next.js app.
- Render root `docs/**/*.md` files directly with Fumadocs MDX.
- Make the whole repository discoverable through ordered navigation, local
  search, page tables of contents, metadata, and edit-on-GitHub links.
- Expand the current guides into a coherent handbook covering the system,
  every application, every service, every shared package, development,
  contracts, security, deployment, maintenance, troubleshooting, and
  documentation authoring.
- Keep durable facts in Markdown beside the code they describe and update them
  in the same commit as behavior changes.
- Give agents an explicit information architecture and authoring contract so a
  new page has one obvious location and can be validated in CI.
- Commit the implementation in small, coherent phases.

## Non-goals

- Do not add a remote CMS, database, authentication system, or embedded editor
  to the deployed site.
- Do not duplicate People, Projects, Portal, or Web product interfaces inside
  documentation.
- Do not generate API promises from implementation details that are not stable
  contracts.
- Do not publish secrets, provider account identifiers that are not already
  public configuration, or sensitive incident records.
- Do not replace package-owned tests or executable schemas with prose.
- Do not deploy the site or change DNS/provider settings in this repository
  change; keep it ready for an independent hosting project.

## Approaches Considered

### Direct root Markdown source — selected

Fumadocs reads `docs/` directly. Markdown stays useful in local editors and on
GitHub, while the site adds navigation and search. This has one source of truth
and the lowest drift risk.

### Generated mirror

A build step could transform root Markdown into an app-local content folder.
This would preserve the source files byte-for-byte but introduce generated
state, extra watch behavior, and a failure mode where the site differs from the
files a contributor edited.

### Separate site content

The root guides and site pages could be maintained independently. This offers
the most presentation freedom but creates two authoritative explanations of
the same system, so it was rejected.

## Application Boundary

`apps/docs` owns only documentation presentation and content loading. It may
depend on Fumadocs, Next.js, React, and shared repository presets. It must not
become a runtime dependency of another deployable or import product components
from another app. It may link to the public Web, People, Projects, and Portal
origins, but it does not call their private routes.

The app uses the App Router and remains server-first. A small client boundary
is acceptable for Fumadocs-provided search, theme, and navigation behavior.
Documentation pages are statically enumerable with `generateStaticParams` and
use static metadata derived from their Markdown records.

## Content Source and Authoring Contract

- Content lives under root `docs/` as uppercase-snake-case `.md` files.
- Each page has YAML frontmatter with at least `title` and `description`.
- Each page retains one visible H1 in its Markdown body so the local file is
  understandable without the site. The route renderer therefore does not add
  a second title above the body.
- Root `docs/meta.json` defines the sidebar order and section labels. Folders
  may add their own `meta.json` when the information architecture grows.
- The Fumadocs source points at root `docs/`; no tracked content mirror exists
  under `apps/docs`.
- Existing relative Markdown links remain valid locally. Site rendering maps
  repository Markdown targets to their documentation routes.
- Mermaid code fences remain the portable diagram syntax. The site converts
  them through Fumadocs' supported Mermaid MDX plugin and renderer.
- The authoring guide documents frontmatter, filenames, links, diagrams,
  review expectations, and the optional local Fumadocs Studio command.
- Documentation policy tests validate frontmatter, unique page identity,
  existing local links, README discoverability, and required navigation
  coverage.

## Information Architecture

The initial sidebar is organized for progressive disclosure:

1. **Start here** — handbook home, repository overview, quick start, and
   workspace map.
2. **System design** — architecture, data flow, state ownership, schemas, and
   API contracts.
3. **Applications** — Web, People, Projects, and Portal responsibilities,
   routes, data loading, UI ownership, metadata, and failure/loading states.
4. **Services** — API, GitHub App, and Mailer responsibilities, authentication,
   storage, request flows, retries, and operational boundaries.
5. **Shared packages** — schemas, UI primitives, TypeScript presets, and ESLint
   policy, including how each package should be extended.
6. **Development** — setup, commands, repository conventions, testing,
   debugging, dependency policy, and documentation authoring.
7. **Operations** — environment variables, CI, deployment, migrations,
   observability, recovery, and security.
8. **Reference** — route and workspace inventories, contract reference,
   terminology, and troubleshooting index.

Existing living guides are retained and expanded. New pages split material
only where a reader benefits from a dedicated stable destination. The root
README remains the concise repository entry point and links to every Markdown
page as required by repository policy.

## Site Experience

- Use Fumadocs' standard docs layout rather than recreating navigation.
- Brand the site as “SCS PDN Documentation” with restrained semantic colors,
  accessible light and dark themes, and the University crest already present
  in the repository when an asset is needed.
- Provide desktop sidebar navigation, accessible mobile navigation, keyboard
  search, breadcrumbs, page table of contents, previous/next links, and a link
  to edit each page on GitHub.
- Provide a small documentation landing page focused on finding information,
  not a marketing hero.
- Serve that landing page at `/` and the Fumadocs handbook at `/docs`. The
  handbook index is `/docs`, and all source-derived pages remain beneath that
  stable base path.
- Convert source filenames to lowercase kebab-case public slugs, so
  `API_CONTRACTS.md` is published at `/docs/api-contracts`. Local Markdown links
  continue to target real `.md` files; the site source adapter performs the URL
  mapping and canonical metadata uses the public slug.
- Expose `robots.txt`, `sitemap.xml`, `llms.txt`, and an all-document Markdown
  endpoint using Fumadocs-supported source utilities where practical.
- Use repository-relative links in content and canonical public URLs only in
  application configuration. The initial canonical origin is
  `https://docs.scs-pdn.space`, overridable through typed configuration if the
  established app pattern requires it.

## Search and Machine Readability

Use Fumadocs' self-hosted search route generated from the source collection.
No external search account is required. Search indexes only public Markdown
content and must not read source files outside `docs/`.

Provide machine-readable documentation endpoints for agents without inventing
a separate content format. They are derived from the same source collection,
and the authoring guide tells agents to change the Markdown source rather than
generated outputs.

## Validation

`@scs/docs` declares the same relevant workspace gates as the other Next.js
apps: lint, production typecheck, test typecheck, tests, build, formatting, and
Knip. Tests cover source loading, navigation completeness, metadata, static
route generation, search/agent endpoints, and the rule that root Markdown is
the only documentation content source.

Repository policy tests are extended before behavior changes where practical.
The complete repository gate remains the final acceptance test. A production
build must include every documented route and must not introduce environment
variables without updating the environment catalog.

## Commit Phases

1. `docs: design repository documentation site`
2. `feat(docs): add Fumadocs application foundation`
3. `docs: organize and expand repository handbook`
4. `test(docs): enforce documentation site contracts`
5. `chore(docs): complete monorepo integration`

Each phase must be internally coherent and pass its narrowest relevant checks.
The final phase runs the complete repository gate before push.

## Builder Decisions

The builder may choose exact Fumadocs component props, icon choices, and minor
page grouping when current package APIs require it. The builder must prefer
current official Fumadocs APIs, existing shared lint/TypeScript presets, alias
imports, and the repository's installed dependency-range policy. Any change to
the public hostname, deployment provider, trust boundaries, or authoritative
content location requires human direction.
