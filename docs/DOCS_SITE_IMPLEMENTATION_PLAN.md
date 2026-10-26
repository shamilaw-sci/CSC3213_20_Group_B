---
title: Documentation site implementation plan
description: Tested delivery phases for the repository handbook and its Fumadocs application.
---

# Repository Documentation Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an independently deployable Fumadocs application that renders an
expanded, searchable repository handbook directly from root Markdown files.

**Architecture:** `apps/docs` is a server-first Next.js workspace. Fumadocs MDX
loads `../../docs` as its only content collection, maps uppercase-snake-case
filenames to lowercase kebab-case `/docs/*` URLs, and derives search and LLM
representations from the same source. Root documentation policy tests keep the
Markdown, sidebar metadata, README index, and published routes aligned.

**Tech Stack:** Bun 1.4.4, Turborepo 2.11, Next.js 16, React 19, Tailwind CSS 4,
Fumadocs Core/UI/MDX, TypeScript 6, Vitest, Testing Library, Zod/T3 Env, Mermaid.

**Spec:** `docs/DOCS_SITE_DESIGN.md`

## Global Constraints

- Work directly in the current checkout; never create or use a Git worktree.
- Keep every app and service independently deployable.
- Root `docs/**/*.md` is the only authored documentation content source.
- Keep documentation Markdown readable locally and on GitHub, including one
  visible H1 per file.
- Use `@/` aliases and package exports for cross-directory imports.
- Extend `@scs/tsconfig` and `@scs/eslint-config`; do not copy central policy.
- Do not add authentication, a CMS, a deployed editor, or a new secret.
- Do not publish credential values or sensitive incident material.
- Use current official Fumadocs APIs and versions accepted by the repository's
  seven-day dependency-age policy.
- Put tests in `apps/docs/tests` and keep production/test typechecking separate.
- Commit each task independently with the exact Conventional Commit subject
  listed by the task.

## Review Focus

- A root Markdown file missing frontmatter or sidebar coverage must fail a
  repository policy test, not silently disappear from the site (Task 2).
- `API_CONTRACTS.md`, nested files, anchors, and relative `.md` links must map
  to stable lowercase kebab-case site URLs while local links remain usable
  (Tasks 1 and 2).
- Unknown `/docs/*` paths and unknown per-page Markdown paths must return the
  standard not-found response rather than an empty page (Tasks 1 and 3).
- Search, `llms.txt`, `llms-full.txt`, and per-page Markdown must contain only
  public files under root `docs/` (Task 3).
- A root documentation edit must invalidate `@scs/docs` build caching even
  though the files live outside the workspace directory (Task 1).

---

## File Structure

### Application-owned files

- `apps/docs/package.json` — scripts and runtime/development dependencies.
- `apps/docs/turbo.json` — includes root `docs/**` in build inputs.
- `apps/docs/next.config.mjs` — Fumadocs MDX plugin and Markdown rewrites.
- `apps/docs/source.config.ts` — root collection and processed Markdown.
- `apps/docs/tsconfig.json` and `tsconfig.test.json` — production/test projects.
- `apps/docs/eslint.config.ts`, `knip.json`, `postcss.config.mjs`,
  `vitest.config.mts` — workspace tooling.
- `apps/docs/src/app` — landing, docs route, metadata routes, search, LLM routes,
  and Next.js fallback/loading files.
- `apps/docs/src/components` — app-owned layout, landing, and MDX compositions.
- `apps/docs/src/config` — typed public origin and immutable site metadata.
- `apps/docs/src/lib` — source loader, slug/link mapping, and LLM URL helpers.
- `apps/docs/tests` — source, routing, metadata, endpoint, and UI contracts.

### Repository-owned content and policy

- `docs/*.md` — handbook pages and existing living guides.
- `docs/meta.json` — Fumadocs navigation order and section separators.
- `README.md` — concise entry point and direct link to every Markdown page.
- `scripts/check-documentation.mts` — source-format and discoverability policy.
- `test/repository/check-documentation.test.ts` — policy characterization.
- `test/repository/application-fallbacks.test.ts` and
  `application-shells.test.ts` — include the new Next.js app.
- `docs/ARCHITECTURE.md`, `ENVIRONMENT_VARIABLES.md`, `CI.md`, and
  `OPERATIONS.md` — include the new deployable in living boundaries.

---

### Task 1: Fumadocs application foundation

**Files:**

- Create: `apps/docs/package.json`, `turbo.json`, `next.config.mjs`,
  `source.config.ts`, `tsconfig.json`, `tsconfig.test.json`,
  `eslint.config.ts`, `knip.json`, `postcss.config.mjs`, and
  `vitest.config.mts`
- Create: `apps/docs/src/setupTests.ts`
- Create: `apps/docs/src/app/globals.css`, `layout.tsx`, `page.tsx`,
  `not-found.tsx`, `error.tsx`, `global-error.tsx`, and
  `global-not-found.tsx`
- Create: `apps/docs/src/app/docs/layout.tsx`
- Create: `apps/docs/src/app/docs/[[...slug]]/page.tsx` and `loading.tsx`
- Create: `apps/docs/src/components/layout/docs-home.tsx`
- Create: `apps/docs/src/components/mdx/mdx-components.tsx`
- Create: `apps/docs/src/config/public.env.config.ts` and `site.config.ts`
- Create: `apps/docs/src/lib/documentation-path.ts` and `source.ts`
- Create: `apps/docs/tests/lib/documentation-path.test.ts`
- Create: `apps/docs/tests/app/docs-page.test.ts`
- Modify: `.gitignore`, `bun.lock`, and `docs/ENVIRONMENT_VARIABLES.md`

**Interfaces:**

- Produces `toDocumentationSlugs(path: string): string[]`,
  `toDocumentationUrl(path: string): string`,
  `rewriteDocumentationHref(href: string): string`, `source` with
  `baseUrl: '/docs'`, and `siteConfig` with its public identity/origin.
- Consumes root `docs/**/*.md`, `@scs/tsconfig/nextjs.json`, and
  `@scs/eslint-config/next`.

- [ ] **Step 1: Write failing path and route tests.** Assert that
      `API_CONTRACTS.md` maps to `['api-contracts']`, nested paths map
      segment-by-segment, fragments survive link rewriting, external/anchor links
      remain unchanged, `/docs` resolves the handbook index, and an unknown slug
      calls `notFound()`.
- [ ] **Step 2: Run `bun --filter '@scs/docs' test`.** Expect failure because
      the workspace and interfaces do not exist.
- [ ] **Step 3: Add the workspace and dependencies.** Declare the same gates as
      `@scs/web`. Add Fumadocs Core/UI/MDX, Mermaid, Next.js, React, T3 Env, Zod,
      and the existing test/toolchain packages through Bun. Do not initialize
      another Git repository.
- [ ] **Step 4: Configure monorepo-aware builds.** Point Fumadocs MDX at
      `../../docs`, enable processed Markdown and Mermaid fences, add
      `$TURBO_ROOT$/docs/**` only to `@scs/docs#build` inputs, and ignore generated
      `.source` state.
- [ ] **Step 5: Implement the source and routes.** Keep slug conversion in
      `documentation-path.ts`; use it in the loader and custom MDX anchor. Render
      Markdown in `DocsPage`/`DocsBody` without adding a second H1. Generate static
      params/metadata and use `notFound()` for unknown pages.
- [ ] **Step 6: Add the minimal shell and landing page.** Use `RootProvider`
      and standard `DocsLayout`; link directly to Start here, Architecture,
      Development, API contracts, Operations, and Security.
- [ ] **Step 7: Run the owning workspace gate.** Run lint, typecheck,
      typecheck:test, test, and build for `@scs/docs`; expect all commands to exit
      0 and the build to list `/`, `/docs`, and generated document routes.
- [ ] **Step 8: Commit.**

  ```powershell
  git add .gitignore apps/docs bun.lock docs/ENVIRONMENT_VARIABLES.md
  git commit -m "feat(docs): add Fumadocs application foundation"
  ```

---

### Task 2: Organize and expand the repository handbook

**Files:**

- Create: `docs/INDEX.md`, `REPOSITORY_OVERVIEW.md`, `AUTHENTICATION.md`,
  `PUBLIC_DATA.md`, `UI_SYSTEM.md`, `TESTING.md`,
  `DEPENDENCY_MANAGEMENT.md`, `TROUBLESHOOTING.md`,
  `DOCUMENTATION_AUTHORING.md`, `ROUTE_REFERENCE.md`, and `GLOSSARY.md`
- Create: `docs/APPLICATION_WEB.md`, `APPLICATION_PEOPLE.md`,
  `APPLICATION_PROJECTS.md`, and `APPLICATION_PORTAL.md`
- Create: `docs/SERVICE_API.md`, `SERVICE_GITHUB_APP.md`, and
  `SERVICE_MAILER.md`
- Create: `docs/PACKAGE_SCHEMAS.md`, `PACKAGE_UI.md`, `PACKAGE_TSCONFIG.md`,
  and `PACKAGE_ESLINT_CONFIG.md`
- Create: `docs/meta.json`
- Modify: every existing `docs/*.md` guide and `README.md`
- Modify: `scripts/check-documentation.mts`
- Modify: `test/repository/check-documentation.test.ts`
- Create: `apps/docs/tests/content/documentation-source.test.ts`

**Interfaces:**

- Produces one frontmatter-complete Markdown corpus and one exhaustive
  `meta.json` navigation order.
- Consumes `source` and slug helpers from Task 1.

- [ ] **Step 1: Extend failing policy tests.** Reject missing
      `title`/`description`, a page absent from `meta.json`, duplicate navigation
      entries, and a README without a direct page link. Assert every source page
      has one H1 and a unique slug/navigation entry.
- [ ] **Step 2: Run `bun run test:docs` and the Docs tests.** Expect failure on
      the current frontmatter-free corpus.
- [ ] **Step 3: Implement documentation validation.** Parse bounded YAML
      frontmatter, recursively discover `docs/**/*.md`, validate navigation
      references, and preserve all existing policy checks.
- [ ] **Step 4: Add frontmatter to existing guides.** Retain their H1/content
      and do not weaken security or operational warnings.
- [ ] **Step 5: Write workspace pages from current code.** For every app,
      service, and package, document responsibility, directory map, entry points,
      routes/exports, owned state, configuration, tests, deployment boundary, and
      common change workflow.
- [ ] **Step 6: Write cross-cutting guides.** Cover auth, public data, UI,
      tests, dependency updates, routes, troubleshooting, terms, and authoring.
      Link authoritative existing tables instead of duplicating them.
- [ ] **Step 7: Add ordered navigation and README discovery.** Use the eight
      design sections and add a direct README entry for every Markdown page.
- [ ] **Step 8: Run docs:check, test:repo, Docs tests, and Docs build.** Expect
      zero failures and one generated route per Markdown page.
- [ ] **Step 9: Commit.**

  ```powershell
  git add README.md docs scripts/check-documentation.mts test/repository/check-documentation.test.ts apps/docs/tests/content
  git commit -m "docs: organize and expand repository handbook"
  ```

---

### Task 3: Add search, metadata, and agent-readable routes

**Files:**

- Create: `apps/docs/src/app/api/search/route.ts`
- Create: `apps/docs/src/app/llms.txt/route.ts`
- Create: `apps/docs/src/app/llms-full.txt/route.ts`
- Create: `apps/docs/src/app/llms.mdx/docs/[[...slug]]/route.ts`
- Create: `apps/docs/src/app/robots.ts` and `sitemap.ts`
- Create: `apps/docs/src/lib/llms.ts` and `metadata.ts`
- Create: `apps/docs/tests/app/search-route.test.ts`
- Create: `apps/docs/tests/app/llms-routes.test.ts`
- Create: `apps/docs/tests/app/metadata-routes.test.ts`
- Modify: `apps/docs/src/app/docs/[[...slug]]/page.tsx`
- Modify: `apps/docs/next.config.mjs`
- Modify: `docs/DOCUMENTATION_AUTHORING.md`

**Interfaces:**

- Produces `docsLlms`,
  `getPageMarkdownUrl(page): { segments: string[]; url: string }`, and static
  search, LLM, per-page Markdown, robots, and sitemap responses.
- Consumes `source`, `siteConfig`, and the completed corpus.

- [ ] **Step 1: Write failing endpoint tests.** Search must find an
      architecture term; LLM responses must include only root docs; unknown
      per-page Markdown must 404; sitemap must use canonical kebab-case URLs and
      omit internal routes; robots must reference the sitemap.
- [ ] **Step 2: Run Docs tests.** Expect failure because routes are absent.
- [ ] **Step 3: Implement self-hosted static search.** Use Fumadocs
      `createFromSource(source)` static GET and its supported static UI client.
- [ ] **Step 4: Implement LLM representations.** Use
      `llms(source, { renderPage })`, processed Markdown, official index/full/page
      routes, `.md` rewrites, and page copy/open/edit actions. Do not add AI chat
      or MCP.
- [ ] **Step 5: Implement metadata routes.** Build canonical sitemap entries
      from the source and `/`; generate safe robots and page metadata.
- [ ] **Step 6: Run the full Docs workspace gate.** Expect all commands to
      exit 0 and all new routes in the build output.
- [ ] **Step 7: Commit.**

  ```powershell
  git add apps/docs docs/DOCUMENTATION_AUTHORING.md
  git commit -m "feat(docs): add searchable agent-ready reference"
  ```

---

### Task 4: Enforce application and documentation contracts

**Files:**

- Create: `apps/docs/tests/app/application-shell.test.tsx`
- Create: `apps/docs/tests/app/fallbacks.test.tsx`
- Create: `apps/docs/tests/app/accessibility-contract.test.tsx`
- Modify: `test/repository/application-shells.test.ts`
- Modify: `test/repository/application-fallbacks.test.ts`
- Modify: `test/repository/page-loading.test.ts`
- Modify: `test/repository/environment-configuration.test.ts`
- Modify: `test/repository/dependency-policy.test.ts`
- Modify: `docs/CI.md` and `docs/TESTING.md`

**Interfaces:**

- Produces repository tests that treat `apps/docs` as the fifth Next.js app.
- Consumes the completed shell, corpus, and endpoints.

- [ ] **Step 1: Add failing repository coverage.** Require Docs loading,
      error, global error, not-found, global not-found, themed layout, skip link,
      accessible mobile navigation, and complete environment metadata.
- [ ] **Step 2: Add focused UI tests.** Require one main landmark,
      keyboard-visible navigation/search, accessible theme controls, semantic
      headings, and no embedded literal color utilities in TSX.
- [ ] **Step 3: Run repository and Docs tests.** Confirm new assertions fail
      for any missing contract.
- [ ] **Step 4: Make minimal shell/fallback corrections.** Use Fumadocs slots
      and semantic tokens; keep composed Docs UI out of `@scs/ui`.
- [ ] **Step 5: Run docs:check, test:repo, Knip, and the full Docs gate.**
      Expect no failure, lint warning, or Knip finding.
- [ ] **Step 6: Commit.**

  ```powershell
  git add apps/docs test/repository docs/CI.md docs/TESTING.md
  git commit -m "test(docs): enforce documentation site contracts"
  ```

---

### Task 5: Complete monorepo integration and handover

**Files:**

- Modify: `README.md`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`,
  `docs/ENVIRONMENT_VARIABLES.md`, `docs/OPERATIONS.md`, `docs/SECURITY.md`,
  and `docs/DOCUMENTATION_AUTHORING.md`
- Delete: `docs/DOCS_SITE_DESIGN.md`
- Delete: `docs/DOCS_SITE_IMPLEMENTATION_PLAN.md`

**Interfaces:**

- Produces final living documentation and a clean independently deployable
  `@scs/docs` workspace.
- Consumes every prior task.

- [ ] **Step 1: Audit against the design.** Move lasting decisions into living
      Architecture, Development, Operations, Testing, or Authoring documentation.
- [ ] **Step 2: Audit the public boundary.** Search for credential-like values,
      private keys, tokens, cookies, personal data, and incident notes; remove
      sensitive material while retaining safe configuration guidance.
- [ ] **Step 3: Run the complete repository gate.** Run docs:check, test:repo,
      Knip, format:check, lint, typecheck, typecheck:test, test, build, and
      `git diff --check`; expect every command to exit 0 with no lint warnings.
- [ ] **Step 4: Remove completed planning records.** Delete the design and
      plan only after their durable decisions exist in living documentation,
      remove their README entries, and rerun docs:check.
- [ ] **Step 5: Commit.**

  ```powershell
  git add README.md docs apps/docs bun.lock test scripts .gitignore
  git commit -m "chore(docs): complete monorepo integration"
  ```

- [ ] **Step 6: Push and verify CI.** Push `main` without force, watch
      Monorepo CI to completion, and confirm a clean tree with
      `origin/main...HEAD` equal to `0 0`.
