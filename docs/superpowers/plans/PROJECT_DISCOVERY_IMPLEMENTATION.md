# Project Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Projects site's competing legacy discovery routes with one clear, filterable, paginated home experience and an approved `/p/[project_slug]` short-link redirect.

**Architecture:** The root route owns one client discovery composition backed by the existing cached `projects.json` adapter. Pure app-owned helpers parse canonical URL state, filter projects, derive filter options, and paginate 12 results at a time; project details remain canonical at `/projects/[project_slug]`, while `/p/[project_slug]` permanently redirects there.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Tailwind CSS 4, shared Radix-based shadcn primitives, Vitest, Testing Library, Bun.

**Spec:** `docs/superpowers/specs/PROJECT_DISCOVERY_DESIGN.md`

## Global Constraints

- Work directly in the current checkout; never create a Git worktree.
- Use `@/` and package exports for cross-directory imports.
- Keep the published project entity schema and public JSON source unchanged.
- Remove legacy routes and helpers directly; do not add redirects, wrappers, re-exports, or compatibility query names.
- The only noncanonical route is `/p/[project_slug]`, which permanently redirects to `/projects/[project_slug]`.
- Use semantic theme tokens and existing `@scs/ui` primitives; do not hardcode colors in TSX.
- Keep lists bounded at 12 results per page and reset `page` to 1 when another filter changes.
- Do not add or change public assets.

## Review Focus

- Empty, whitespace-only, malformed, repeated, or unknown query parameters normalize safely instead of crashing or hiding every project; Task 1 tests this.
- A requested page beyond the filtered result range clamps to the last valid page, while zero or negative pages normalize to 1; Task 1 tests this.
- Long project titles, descriptions, topics, courses, and person identifiers remain bounded and readable without nested actions; Task 3 tests the rendered contract.
- Projects with no optional academic metadata omit those facts without leaving empty labels or the word “Optional”; Task 3 tests this.
- Short links encode the slug into the canonical destination and never render duplicate project content; Task 4 tests this.

---

### Task 1: Canonical Discovery State and Filtering

**Files:**

- Create: `apps/projects/src/lib/projects/discovery.ts`
- Create: `apps/projects/tests/lib/projects/discovery.test.ts`
- Modify: `apps/projects/src/lib/projects/api-client.ts`
- Modify: `apps/projects/src/lib/projects/queries.ts`
- Modify: `apps/projects/tests/lib/projects/api-client.test.ts`
- Modify: `apps/projects/tests/lib/projects/queries.test.ts`

**Interfaces:**

- Consumes: `Project`, `ProjectStatus`, and `ProjectType` from `@/lib/projects/types`; the existing `fetchProjects()` full-list adapter.
- Produces: `PROJECTS_PER_PAGE = 12`; `ProjectDiscoveryState`; `parseProjectDiscoveryParams(params: URLSearchParams): ProjectDiscoveryState`; `filterProjects(projects: Project[], state: ProjectDiscoveryState): Project[]`; `paginateProjects(projects: Project[], requestedPage: number): ProjectPage`; `deriveDiscoveryOptions(projects: Project[]): DiscoveryOptions`; `buildDiscoveryUrl(state: ProjectDiscoveryState): string`.

- [ ] **Step 1: Write failing discovery tests**

Cover canonical `q`, `category`, `topic`, `course`, `status`, `type`, `person`, and `page` parsing; whitespace/unknown-value normalization; combined filtering; exact case-insensitive username matching; 12-item pagination; out-of-range page clamping; deterministic option derivation; canonical URL output; and page reset performed by a state patch helper.

- [ ] **Step 2: Run the discovery test and verify RED**

Run: `bun --filter '@scs/projects' test -- tests/lib/projects/discovery.test.ts`

Expected: FAIL because `@/lib/projects/discovery` does not exist.

- [ ] **Step 3: Implement the pure discovery interfaces**

Keep URL parsing, filtering, option derivation, and pagination free of React and Next.js imports. Search the same project/person/link fields currently covered by `searchProjectList`. Use `topic`, never the legacy `tag` query name.

- [ ] **Step 4: Remove legacy adapter and server-query helpers**

Delete `fetchProjectSearch`, `fetchProjectsByUsername`, `ProjectByPersonEntry`, person-projection parsing, and filter behavior from `fetchProjects`. Reduce server queries to functions still consumed by the canonical sitemap and project routes; update their tests to reject dead compatibility exports.

- [ ] **Step 5: Run narrow tests and workspace typechecks**

Run: `bun --filter '@scs/projects' test -- tests/lib/projects/discovery.test.ts tests/lib/projects/api-client.test.ts tests/lib/projects/queries.test.ts`

Run: `bun --filter '@scs/projects' typecheck`

Run: `bun --filter '@scs/projects' typecheck:test`

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```powershell
git add -- apps/projects/src/lib/projects apps/projects/tests/lib/projects
git commit -m "refactor(projects): unify discovery state"
```

### Task 2: Unified Home Discovery Experience

**Files:**

- Modify: `apps/projects/src/app/_components/home.tsx`
- Modify: `apps/projects/src/app/page.tsx`
- Modify: `apps/projects/src/components/projects/project-states.tsx`
- Create: `apps/projects/tests/components/projects/home.test.tsx`

**Interfaces:**

- Consumes: all Task 1 discovery interfaces and `fetchProjects()`.
- Produces: one root composition that synchronizes controls with canonical URL parameters and renders the current bounded `ProjectPage`.

- [ ] **Step 1: Write failing home experience tests**

Test the no-filter **All Projects** state, visible **Search Projects** label and examples, Category/Topic/Course/Status/Project Type/Person controls, canonical URL updates, page reset after filter changes, active-filter removal, Clear Filters, polite result-count live region, singular/plural labels, pagination controls, retry behavior, and responsive control structure without horizontal-overflow classes.

- [ ] **Step 2: Run the home test and verify RED**

Run: `bun --filter '@scs/projects' test -- tests/components/projects/home.test.tsx`

Expected: FAIL because the legacy home does not expose the unified discovery controls.

- [ ] **Step 3: Implement the unified root composition**

Use shared `Input`, `Label`, `Select`, `Button`, `Badge`, and existing feedback primitives. Load the full cached project list once per retry, derive options locally, apply Task 1 helpers, and push canonical query URLs through Next navigation. Use specific copy from the design and omit featured inference.

- [ ] **Step 4: Replace the root loading geometry**

Update `ProjectHomeLoading` and related home skeletons to mirror the search field, collapsible/stacked filters, result summary, and result cards. Remove legacy hero-button, browse-tile, Featured, and View-button skeleton shapes.

- [ ] **Step 5: Run home tests, lint, and typechecks**

Run: `bun --filter '@scs/projects' test -- tests/components/projects/home.test.tsx`

Run: `bun --filter '@scs/projects' lint`

Run: `bun --filter '@scs/projects' typecheck`

Run: `bun --filter '@scs/projects' typecheck:test`

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```powershell
git add -- apps/projects/src/app apps/projects/src/components/projects/project-states.tsx apps/projects/tests/components/projects/home.test.tsx
git commit -m "feat(projects): create unified discovery home"
```

### Task 3: Simplified Project Cards and Details

**Files:**

- Modify: `apps/projects/src/components/projects/registry-ui.tsx`
- Modify: `apps/projects/src/app/projects/[project_slug]/_components/project-detail-page.tsx`
- Modify: `apps/projects/src/components/projects/project-states.tsx`
- Create: `apps/projects/tests/components/projects/registry-ui.test.tsx`

**Interfaces:**

- Consumes: canonical discovery URL builder from Task 1 and existing `Project` data.
- Produces: simplified `ProjectGrid`, card, detail, metadata, and related-project rendering used by Tasks 2 and 5.

- [ ] **Step 1: Write failing registry UI tests**

Assert card priority (title, two-line description, type, status, optional course/year, at most 2 topics), one link target, no View control, decorative icon semantics, long-content containment classes, canonical filter URLs, project-scoped person roles, absent optional metadata omission, `Intl.DateTimeFormat` output, root breadcrumb, and no Related Projects section when empty.

- [ ] **Step 2: Run the registry UI test and verify RED**

Run: `bun --filter '@scs/projects' test -- tests/components/projects/registry-ui.test.tsx`

Expected: FAIL on the legacy View control, optional labels, and old filter URLs.

- [ ] **Step 3: Implement simplified cards and details**

Split the existing oversized registry module only where a focused app-owned component makes tests and ownership clearer. Keep all colors semantic, use one card link, hide decorative icons, emit canonical home query URLs, omit missing facts, and format dates with `Intl.DateTimeFormat`.

- [ ] **Step 4: Align detail and card skeletons**

Update project card and detail loading geometry in `project-states.tsx`; remove the redundant action skeleton and mirror optional metadata without reserving empty rows.

- [ ] **Step 5: Run registry tests and workspace checks**

Run: `bun --filter '@scs/projects' test -- tests/components/projects/registry-ui.test.tsx`

Run: `bun --filter '@scs/projects' lint`

Run: `bun --filter '@scs/projects' typecheck`

Run: `bun --filter '@scs/projects' typecheck:test`

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```powershell
git add -- apps/projects/src/components/projects apps/projects/src/app/projects apps/projects/tests/components/projects
git commit -m "refactor(projects): simplify project presentation"
```

### Task 4: Header, Short URL, Metadata, and Canonical Indexing

**Files:**

- Modify: `apps/projects/src/components/layout/site-header.tsx`
- Modify: `apps/projects/src/components/layout/site-footer.tsx`
- Modify: `apps/projects/tests/components/layout/site-header.test.tsx`
- Create: `apps/projects/src/app/p/[project_slug]/page.tsx`
- Create: `apps/projects/tests/app/short-project-route.test.ts`
- Modify: `apps/projects/src/app/layout.tsx`
- Modify: `apps/projects/src/app/sitemap.ts`
- Create: `apps/projects/tests/app/sitemap.test.ts`

**Interfaces:**

- Consumes: canonical project detail route and Task 1 discovery URL format.
- Produces: minimal global shell, permanent short-link redirect, and sitemap containing only root plus canonical project detail pages.

- [ ] **Step 1: Write failing shell, redirect, and sitemap tests**

Assert the header contains the brand/home destination and theme control without legacy navigation or a mobile sheet; the footer emits only canonical root/filter links; `/p/scs-pdn-portal` calls `permanentRedirect('/projects/scs-pdn-portal')`; encoded hostile slug input cannot alter the destination path; the sitemap excludes short and legacy discovery URLs; and layout metadata no longer advertises nonexistent feeds.

- [ ] **Step 2: Run the tests and verify RED**

Run: `bun --filter '@scs/projects' test -- tests/components/layout/site-header.test.tsx tests/app/short-project-route.test.ts tests/app/sitemap.test.ts`

Expected: FAIL because the legacy navigation remains and the short route/tests do not exist.

- [ ] **Step 3: Implement the minimal shell and short redirect**

Remove the redundant sheet/menu. Resolve `params: Promise<{ project_slug: string }>` and call Next.js `permanentRedirect` with an encoded slug. Keep `/projects/[project_slug]` as the only rendering route.

- [ ] **Step 4: Simplify metadata and sitemap**

Describe the unified home, remove nonexistent feed alternates, and return only `/` plus `/projects/[project_slug]` entries from the sitemap. Do not index `/p` routes or filtered query combinations.

- [ ] **Step 5: Run shell tests and workspace checks**

Run: `bun --filter '@scs/projects' test -- tests/components/layout/site-header.test.tsx tests/app/short-project-route.test.ts tests/app/sitemap.test.ts`

Run: `bun --filter '@scs/projects' lint`

Run: `bun --filter '@scs/projects' typecheck`

Run: `bun --filter '@scs/projects' typecheck:test`

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```powershell
git add -- apps/projects/src/components/layout apps/projects/src/app/p apps/projects/src/app/layout.tsx apps/projects/src/app/sitemap.ts apps/projects/tests
git commit -m "feat(projects): add canonical discovery shell"
```

### Task 5: Remove Legacy Discovery Architecture

**Files:**

- Delete: `apps/projects/src/app/search/`
- Delete: `apps/projects/src/app/find-by/`
- Delete: `apps/projects/src/app/categories/`
- Delete: `apps/projects/src/app/topics/`
- Delete: `apps/projects/src/app/courses/`
- Delete: `apps/projects/src/components/projects/facet-index.tsx`
- Delete: `apps/projects/src/components/projects/project-collection.tsx`
- Modify: `apps/projects/src/components/projects/project-states.tsx`
- Create: `apps/projects/tests/architecture.test.ts`
- Modify: `docs/superpowers/specs/PROJECT_DISCOVERY_DESIGN.md`

**Interfaces:**

- Consumes: canonical home, detail, and short-link surfaces from Tasks 2–4.
- Produces: a codebase with no legacy route, component, export, URL, loading state, or compatibility terminology.

- [ ] **Step 1: Write the failing architecture test**

Assert the removed route/component directories do not exist; source files contain no internal links to `/search`, `/find-by`, `/categories`, `/topics`, or `/courses`; no legacy fetch/query exports remain; and user-facing Projects copy does not use Collection or Tag as alternate names for Category or Topic.

- [ ] **Step 2: Run the architecture test and verify RED**

Run: `bun --filter '@scs/projects' test -- tests/architecture.test.ts`

Expected: FAIL with the current legacy routes and components present.

- [ ] **Step 3: Delete legacy routes and components**

Remove the listed folders and files with no redirects or compatibility modules. Remove now-dead loading exports and imports from `project-states.tsx`.

- [ ] **Step 4: Remove remaining legacy references**

Use `rg` to trace and remove stale route strings, copy, imports, tests, exports, and documentation references. Do not change project-detail canonical URLs or the approved `/p` redirect.

- [ ] **Step 5: Run the complete Projects gate**

Run: `bun --filter '@scs/projects' lint`

Run: `bun --filter '@scs/projects' typecheck`

Run: `bun --filter '@scs/projects' typecheck:test`

Run: `bun --filter '@scs/projects' test`

Run: `bun --filter '@scs/projects' build`

Run: `bun --filter '@scs/projects' knip`

Run: `git diff --check`

Expected: all commands exit 0 and the Next route table contains `/`, `/projects/[project_slug]`, and `/p/[project_slug]` but none of the removed discovery routes.

- [ ] **Step 6: Commit**

```powershell
git add -A -- apps/projects docs/superpowers
git commit -m "refactor(projects): remove legacy discovery routes"
```

### Task 6: Repository Verification and Delivery

**Files:**

- Modify only files required to fix verification failures caused by Tasks 1–5.

**Interfaces:**

- Consumes: completed Projects implementation.
- Produces: verified, committed, pushed repository state.

- [ ] **Step 1: Run the repository gate**

Run in order: `bun run docs:check`, `bun run knip`, `bun run format:check`, `bun run lint`, `bun run typecheck`, `bun run typecheck:test`, `bun run test`, `bun run build`, and `git diff --check`.

Expected: every command exits 0. Existing warnings must be reported by name; no failure may be bypassed.

- [ ] **Step 2: Review the complete diff against the approved design**

Confirm the one canonical discovery flow, route removal, 12-result pagination, URL state, simplified cards/details, short redirect, loading/error states, semantic colors, and absence of unrelated edits.

- [ ] **Step 3: Commit any coherent verification fixes**

Use a Conventional Commit subject scoped to the actual fix. Do not amend or mix unrelated cleanup.

- [ ] **Step 4: Push `main` without force**

Run: `git push origin main`

Expected: the remote advances to the final verified commit and `git status --short` is empty.
