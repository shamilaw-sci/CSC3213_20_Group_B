# Project Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Projects filter-dashboard homepage with a schema-led showcase and path-based project directories.

**Architecture:** Keep `ProjectSchema` as the only project contract. Add pure route and collection helpers, reuse one app-owned directory composition across path-based routes, and derive homepage sections from validated published projects. Course navigation remains owned by the department Web app.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, shared shadcn primitives from `@scs/ui`, Zod contracts from `@scs/schemas`, Vitest, Testing Library, Bun, Turborepo.

**Spec:** `docs/superpowers/specs/PROJECT_DISCOVERY_DESIGN.md`

## Global Constraints

- Work directly in the current checkout; never create or use a Git worktree.
- Preserve independently deployable applications and the public-data boundary.
- Import project contracts directly from `@scs/schemas`; do not re-export them.
- Use `@/` and package aliases for cross-directory imports.
- Keep reusable primitives in `packages/ui` and composed Projects UI in `apps/projects`.
- Emit no user-facing discovery query strings and add no Projects-owned course routes.
- Keep `/projects/[project_slug]` canonical and `/p/[project_slug]` as its permanent redirect.
- Use semantic theme tokens only; add no embedded TSX colors or public assets.
- Do not infer project type, course ownership, featured status, or popularity.
- Write each behavior test first, observe the expected failure, then implement the minimum change.

## Review Focus

- Unicode, `C++`, slashes, percent signs, and repeated whitespace produce stable safe collection/search paths: Task 1 tests these inputs.
- Different labels that canonicalize to one segment are combined rather than producing duplicate collections: Task 1 tests collisions.
- Unknown categories/topics and schema-valid empty project types render the correct distinct state: Task 2 tests both branches.
- Network failure is not misreported as an empty or missing collection: Task 2 component tests the error branch separately.
- Long titles, missing cover images, and narrow layouts retain one clear card link with no overflow or hover-only information: Task 4 tests card semantics and fallback content.

---

### Task 1: Schema-Derived Collection and Route Model

**Files:**

- Create: `apps/projects/src/lib/projects/collection-navigation.ts`
- Create: `apps/projects/src/lib/projects/collections.ts`
- Create: `apps/projects/tests/lib/projects/collection-navigation.test.ts`
- Create: `apps/projects/tests/lib/projects/collections.test.ts`
- Modify: `docs/superpowers/specs/PROJECT_DISCOVERY_DESIGN.md`
- Create: `docs/superpowers/plans/PROJECT_SHOWCASE_IMPLEMENTATION.md`

**Interfaces:**

- Produces: `ProjectCollection`, `PROJECT_TYPE_SEGMENTS`, `canonicalizeCollectionSegment(value: string): string`, `canonicalizeSearchSegment(value: string): string`, `resolveProjectTypeSegment(segment: string): ProjectType | null`, `parseCollectionPage(segments?: string[]): number | null`, and `buildCollectionPath(collection: ProjectCollection, page?: number): string`.
- Produces: `filterProjectsByCollection(projects: Project[], collection: ProjectCollection): Project[]`, `paginateProjects(projects: Project[], page: number): ProjectPage`, `deriveCollectionSummaries(projects: Project[]): CollectionSummaries`, and `recentProjects(projects: Project[], limit: number): Project[]`.

- [ ] **Step 1: Write failing navigation tests**

Assert literal type paths, `/browse/page/2`, `/categories/research`, `/topics/c%2B%2B`, `/search/c%23`, invalid page segments, Unicode normalization, and combined canonical collisions.

- [ ] **Step 2: Run the navigation test and verify RED**

Run: `bun --filter '@scs/projects' test -- tests/lib/projects/collection-navigation.test.ts`

Expected: FAIL because `collection-navigation.ts` does not exist.

- [ ] **Step 3: Implement the navigation interfaces**

Use an explicit bidirectional mapping for all eleven `ProjectType` values. Apply NFKC, lowercase, trim, delimiter-to-hyphen, repeated-hyphen collapse, and `encodeURIComponent` at the URL boundary. Reject page zero, negative, non-integer, and extra segments.

- [ ] **Step 4: Write and run failing collection tests**

Test exact type/category/topic/search filtering, case-normalized collection matches, collision count aggregation, required-date recent ordering, a stable tie-breaker, and bounded pagination.

Run: `bun --filter '@scs/projects' test -- tests/lib/projects/collections.test.ts`

Expected: FAIL because `collections.ts` does not exist.

- [ ] **Step 5: Implement the collection interfaces and verify GREEN**

Run: `bun --filter '@scs/projects' test -- tests/lib/projects/collection-navigation.test.ts tests/lib/projects/collections.test.ts`

Expected: both files PASS.

- [ ] **Step 6: Validate and commit the approved design plus domain model**

Run: `bun run docs:check; bun --filter '@scs/projects' lint; bun --filter '@scs/projects' typecheck; bun --filter '@scs/projects' typecheck:test; git diff --check`

Commit: `feat(projects): define showcase collections`

### Task 2: Path-Based Directory Routes

**Files:**

- Create: `apps/projects/src/components/projects/project-search-form.tsx`
- Create: `apps/projects/src/components/projects/project-directory.tsx`
- Create: `apps/projects/src/app/browse/[[...segments]]/page.tsx`
- Create: `apps/projects/src/app/browse/[[...segments]]/loading.tsx`
- Create: `apps/projects/src/app/types/[type]/[[...segments]]/page.tsx`
- Create: `apps/projects/src/app/types/[type]/[[...segments]]/loading.tsx`
- Create: `apps/projects/src/app/categories/[category]/[[...segments]]/page.tsx`
- Create: `apps/projects/src/app/categories/[category]/[[...segments]]/loading.tsx`
- Create: `apps/projects/src/app/topics/[topic]/[[...segments]]/page.tsx`
- Create: `apps/projects/src/app/topics/[topic]/[[...segments]]/loading.tsx`
- Create: `apps/projects/src/app/search/[query]/[[...segments]]/page.tsx`
- Create: `apps/projects/src/app/search/[query]/[[...segments]]/loading.tsx`
- Create: `apps/projects/tests/components/projects/project-directory.test.tsx`
- Create: `apps/projects/tests/app/collection-routes.test.ts`

**Interfaces:**

- Consumes: Task 1 route and collection helpers.
- Produces: `ProjectSearchForm`, `ProjectDirectory`, and route adapters for all canonical collection/search paths.

- [ ] **Step 1: Write failing directory component tests**

Test a successful bounded collection, path-based search submission, path-based pagination, schema-valid empty type, unknown category/topic, loading, and network error. Assert that none of the rendered links contains `?`.

- [ ] **Step 2: Run the component test and verify RED**

Run: `bun --filter '@scs/projects' test -- tests/components/projects/project-directory.test.tsx`

Expected: FAIL because the directory components do not exist.

- [ ] **Step 3: Implement the shared directory composition**

Use `fetchProjects` for client-visible loading/error distinction, `ProjectGrid` for results, and the Task 1 helpers for filtering and links. Valid empty types get an empty state; a successful fetch with no matching derived category/topic gets the not-found presentation.

- [ ] **Step 4: Write failing route-adapter tests**

Test literal resolved descriptors for Browse, every project-type segment, category, topic, search, base pages, `/page/2`, malformed pages, and unknown type segments.

- [ ] **Step 5: Implement route adapters and route-specific loading files**

Keep Next.js param parsing inside route files and all product rendering inside `ProjectDirectory`. Invalid structural segments call `notFound()` before rendering.

- [ ] **Step 6: Verify and commit**

Run: `bun --filter '@scs/projects' lint; bun --filter '@scs/projects' typecheck; bun --filter '@scs/projects' typecheck:test; bun --filter '@scs/projects' test`

Expected: all Projects checks PASS.

Commit: `feat(projects): add path-based directories`

### Task 3: Schema-Led Showcase Homepage

**Files:**

- Replace: `apps/projects/src/app/_components/home.tsx`
- Modify: `apps/projects/src/components/projects/project-states.tsx`
- Modify: `apps/projects/tests/components/projects/home.test.tsx`

**Interfaces:**

- Consumes: Task 1 collection summaries, recent ordering, and path builders; Task 2 search form.
- Produces: the homepage showcase and matching page-specific skeleton.

- [ ] **Step 1: Replace homepage tests with failing showcase behavior**

Assert section order, only populated type cards, truthful `OTHER`, recently updated order, compact category/topic links, `/browse` destination, path-based search, omitted empty sections, error retry, one `main` landmark from the layout, and no filter dashboard controls.

- [ ] **Step 2: Run the homepage test and verify RED**

Run: `bun --filter '@scs/projects' test -- tests/components/projects/home.test.tsx`

Expected: FAIL against the current filter dashboard.

- [ ] **Step 3: Implement the showcase homepage**

Retain the existing request cancellation and retry boundary. Render the introduction/search, populated project-type cards, bounded recent projects, secondary category/topic links, and Browse action in the spec order.

- [ ] **Step 4: Update `ProjectHomeLoading` to mirror the new geometry**

Remove select-control skeletons and add type-card, recent-card, and compact collection-link placeholders without changing shared primitives.

- [ ] **Step 5: Verify and commit**

Run: `bun --filter '@scs/projects' lint; bun --filter '@scs/projects' typecheck; bun --filter '@scs/projects' typecheck:test; bun --filter '@scs/projects' test`

Commit: `feat(projects): build schema-led showcase`

### Task 4: Showcase Cards, Detail Links, and App Navigation

**Files:**

- Modify: `apps/projects/src/components/projects/registry-ui.tsx`
- Modify: `apps/projects/src/app/projects/[project_slug]/_components/project-detail-page.tsx`
- Modify: `apps/projects/src/components/layout/site-header.tsx`
- Modify: `apps/projects/src/components/layout/site-footer.tsx`
- Modify: `apps/projects/tests/components/projects/registry-ui.test.tsx`
- Modify: `apps/projects/tests/components/layout/site-header.test.tsx`
- Create: `apps/projects/tests/components/layout/site-footer.test.tsx`

**Interfaces:**

- Consumes: Task 1 path builders and type mappings.
- Produces: showcase-capable single-link cards, path-linked project metadata, Home/Browse navigation, and external department-course links.

- [ ] **Step 1: Write failing card and detail tests**

Test cover-image versus declared-icon fallback, one canonical card link, long-content containment classes, type/category/topic paths, exact project-scoped roles, related-project omission, and course metadata without a Projects course URL.

- [ ] **Step 2: Run the registry tests and verify RED**

Run: `bun --filter '@scs/projects' test -- tests/components/projects/registry-ui.test.tsx`

- [ ] **Step 3: Implement card and detail behavior**

Keep course code/title as text. Add collection-aware breadcrumbs and cross-links. Do not infer a Web per-course destination.

- [ ] **Step 4: Write failing shell tests**

Assert Home and Browse links, accessible current state, no redundant mobile sheet, no query-string destinations, and external Undergraduate/Postgraduate course-index links to the department Web app.

- [ ] **Step 5: Implement header/footer navigation**

Keep the two primary project destinations visible on mobile, preserve the theme control, and use configured/centralized department-site URLs rather than scattering operational URLs through components.

- [ ] **Step 6: Verify and commit**

Run: `bun --filter '@scs/projects' lint; bun --filter '@scs/projects' typecheck; bun --filter '@scs/projects' typecheck:test; bun --filter '@scs/projects' test`

Commit: `feat(projects): refine showcase navigation`

### Task 5: Canonical Indexing and Legacy Query Removal

**Files:**

- Modify: `apps/projects/src/app/page.tsx`
- Modify: `apps/projects/src/app/sitemap.ts`
- Modify: `apps/projects/tests/app/sitemap.test.ts`
- Modify: `apps/projects/tests/architecture.test.ts`
- Modify: `test/repository/application-shells.test.ts`
- Delete: `apps/projects/src/lib/projects/discovery.ts`
- Delete: `apps/projects/tests/lib/projects/discovery.test.ts`

**Interfaces:**

- Consumes: all previous route helpers and collection derivation.
- Produces: canonical sitemap entries, root legacy-parameter redirects, and architecture guards against the retired query model.

- [ ] **Step 1: Write failing indexing and architecture tests**

Assert Home, Browse, populated type/category/topic pages, required pagination pages, and canonical project details. Assert no search or short-link sitemap entries, no discovery query builders, no Projects course routes, and no internal `?` discovery links.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `bun --filter '@scs/projects' test -- tests/app/sitemap.test.ts tests/architecture.test.ts`

- [ ] **Step 3: Implement sitemap and legacy-root redirect behavior**

Redirect only the retired discovery keys `q`, `category`, `topic`, `course`, `status`, `type`, `person`, and `page` from `/` to `/`; do not discard unrelated campaign parameters. Generate collection pages from validated current records and the Task 1 page size.

- [ ] **Step 4: Delete the superseded query discovery implementation**

Trace all imports first, then remove only the now-unreferenced module and test. Update repository shell policy to require the new Home/Browse project shell and path-based collections.

- [ ] **Step 5: Verify and commit**

Run: `bun run test:repo; bun --filter '@scs/projects' lint; bun --filter '@scs/projects' typecheck; bun --filter '@scs/projects' typecheck:test; bun --filter '@scs/projects' test; bun --filter '@scs/projects' build; bun run knip; git diff --check`

Commit: `refactor(projects): retire query discovery`

### Task 6: Documentation, Full Verification, and Delivery

**Files:**

- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md` only if the final route ownership needs clarification
- Modify: `docs/superpowers/specs/PROJECT_DISCOVERY_DESIGN.md` only for implementation-discovered decisions
- Delete: `docs/superpowers/plans/PROJECT_SHOWCASE_IMPLEMENTATION.md` after its lasting decisions are represented in living documentation

**Interfaces:**

- Consumes: the completed implementation.
- Produces: living documentation, a clean verified checkout, coherent final commit(s), and a pushed `main` branch.

- [ ] **Step 1: Update living documentation**

Describe the showcase, canonical path families, Projects/Web course ownership, and local verification including `bun run test:repo`. Remove statements that describe the query-driven homepage.

- [ ] **Step 2: Run the Projects gate**

Run: `bun --filter '@scs/projects' lint; bun --filter '@scs/projects' typecheck; bun --filter '@scs/projects' typecheck:test; bun --filter '@scs/projects' test; bun --filter '@scs/projects' build`

Expected: all declared tasks PASS.

- [ ] **Step 3: Run the complete repository gate**

Run: `bun run docs:check; bun run test:repo; bun run knip; bun run format:check; bun run lint; bun run typecheck; bun run typecheck:test; bun run test; bun run build; git diff --check`

Expected: every command exits zero; report any existing warnings by name.

- [ ] **Step 4: Review the full change set**

Check route collisions, schema fidelity, path-only navigation, missing/error distinctions, semantic colors, mobile containment, unrelated working-tree preservation, and the final diff against the approved spec.

- [ ] **Step 5: Commit, synchronize, and push**

Use Conventional Commit subjects for any remaining coherent phase. Fetch `origin/main`, confirm it has not moved ahead, push without force, and verify `git status -sb` is clean and aligned.
