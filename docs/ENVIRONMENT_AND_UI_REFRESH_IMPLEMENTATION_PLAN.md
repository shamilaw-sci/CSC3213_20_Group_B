# Environment and UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a verified environment-variable catalog, refresh all four Next.js application shells, and simplify Portal editing into a guided Edit–Review–Submit workflow with an explicit advanced JSON escape hatch without changing routes, runtime contracts, or public assets.

**Architecture:** Keep each application independently deployable and keep product compositions in their owning app. Put only reusable shadcn-level theme and feedback primitives in `@scs/ui`; use route-private `_components` and responsibility-named app component folders instead of adding new `custom` or `views` modules. Portal editors share an app-owned state machine and workspace composition while domain forms remain separated by project, course, and profile concerns.

**Tech Stack:** Bun workspaces, Turborepo, Next.js 16 App Router, React 19, TypeScript 6, Tailwind CSS 4, shadcn/Radix primitives, next-themes, Zod/T3 Env, Bun Test, Vitest, Testing Library.

**Spec:** `docs/ENVIRONMENT_AND_UI_REFRESH_DESIGN.md`

## Global Constraints

- Preserve every route, public/internal contract, authentication flow, deployment boundary, and existing capability.
- Do not change, consolidate, regenerate, delete, or rename public assets, favicons, manifests, or published asset URLs.
- Keep browser code behind `services/api`; do not expose service credentials or private automation routes.
- Keep composed navigation and product workflows in their owning app; `packages/ui` receives reusable primitive-level UI only.
- Do not add a CSS framework, component system, analytics product, or runtime dependency for this work.
- Remove an environment variable only after proving it has no runtime, platform, workflow, or compatibility consumer.
- Use the existing Open Sans setup and existing URLs and labels unless a label is demonstrably incorrect.
- Do not use screenshot comparison, pixel matching, or subjective visual approval as verification; test semantics, state transitions, keyboard behavior, validation, and builds.
- Edit, Review, and Advanced JSON must share one canonical draft and must never silently discard or replace user changes.

## Review Focus

- Missing, empty, defaulted, platform-only, and binding-only environment values remain accurately classified and cannot silently escape templates, docs, or cache inputs; Task 1 tests this matrix.
- Theme initialization works for light, dark, and system preferences before hydration even when storage or media-query APIs fail; Task 2 tests these cases.
- Global error and unmatched-route pages render without the root layout, while segment errors retain retry behavior and missing domain records remain 404 states; Task 3 tests the shared contracts and builds every app.
- Desktop keyboard and mobile pointer users can reach every primary navigation destination, observe the active route, close menus, and see focus; Tasks 4–7 add shell-specific tests.
- Editor surface changes preserve the canonical draft, require Apply/Discard/Stay for dirty JSON, and keep published data read-only; Tasks 8–11 test these transitions.
- Existing routes, metadata asset URLs, and every file below an app's `public` directory remain unchanged; Task 12 checks route builds and rejects public-asset diffs.

---

### Task 1: Environment Inventory, Documentation, and Cache Safety

**Files:**

- Modify: `test/repository/environment-configuration.test.ts`
- Modify: `docs/ENVIRONMENT_VARIABLES.md`
- Modify: `turbo.json`

**Interfaces:**

- Consumes: existing T3 Env schemas, Worker environment interfaces, Wrangler variables/secrets/bindings, local templates, and deployment-adapter settings.
- Produces: a single `workspaceVariables` audit matrix with `kind`, `supply`, `status`, and documentation coverage; app-specific Turborepo build inputs for every value capable of changing Next.js output.

- [ ] **Step 1: Extend the repository environment test with the audited matrix**

  Add assertions that every matrix entry appears in its owning template or Wrangler declaration, appears in `docs/ENVIRONMENT_VARIABLES.md`, and has one of `runtime`, `binding`, or `deployment-only` status. Assert that `VERCEL_EXPERIMENTAL_BACKENDS` is deployment-only and that `AUTH_DB`, `GITHUB_APP`, `OPERATION_STATE`, `MUTATION_COORDINATOR`, and `OPERATION_QUEUE` are bindings rather than ordinary variables.

- [ ] **Step 2: Run the repository test and verify the new coverage fails**

  Run: `bun test test/repository/environment-configuration.test.ts`

  Expected: FAIL because the catalog does not yet contain the complete status/supply matrix and `turbo.json` does not declare app build inputs.

- [ ] **Step 3: Document the audited status of every supported configuration name**

  Update `docs/ENVIRONMENT_VARIABLES.md` with workspace tables that identify visibility/kind, source, consumer purpose, default or requirement, and audited status. Record that all current names have a runtime, binding, or provider consumer; do not remove a name merely because application source does not read a deployment-only setting.

- [ ] **Step 4: Add app-specific build environment inputs to Turborepo**

  Configure `@scs/web#build`, `@scs/people#build`, `@scs/projects#build`, and `@scs/portal#build` with the exact variables from their T3 Env schemas so changes invalidate only the owning app's cached build. Preserve the common `build` task's dependency and output behavior.

- [ ] **Step 5: Run focused environment verification**

  Run: `bun test test/repository/environment-configuration.test.ts`

  Expected: PASS with every supported value documented and every Next.js build input represented.

- [ ] **Step 6: Commit the environment audit**

  ```powershell
  git add test/repository/environment-configuration.test.ts docs/ENVIRONMENT_VARIABLES.md turbo.json
  git commit -m "docs: audit monorepo environment configuration"
  ```

### Task 2: Shared Theme and Feedback Primitives

**Files:**

- Create: `packages/ui/src/components/theme-provider.tsx`
- Create: `packages/ui/src/components/theme-init-script.tsx`
- Create: `packages/ui/src/components/theme-toggle.tsx`
- Create: `packages/ui/src/components/error-page-flag.tsx`
- Create: `packages/ui/src/components/feedback-state.tsx`
- Create: `packages/ui/src/styles/theme.css`
- Modify: `packages/ui/package.json`
- Modify: `packages/ui/tests/components.test.tsx`

**Interfaces:**

- Consumes: `Button`, `next-themes`, `lucide-react`, the package `cn` utility, and semantic Tailwind color names.
- Produces: `ThemeProvider(props: ComponentProps<typeof NextThemesProvider>)`, `ThemeInitScript()`, `ThemeToggle({ className?, showLabel?, variant? })`, `ErrorPageFlag()`, and `FeedbackState({ code?, icon?, title, description, actions? })`; exports `@scs/ui/styles/theme.css`.

- [ ] **Step 1: Write failing shared-component contract tests**

  Test server-rendered feedback semantics, theme-toggle accessible naming, optional label rendering, theme-provider defaults (`attribute="class"`, system theme, transition suppression), and the presence of both light and dark semantic variables in the exported stylesheet. Add a browser-capable test for stored dark, stored light, system-dark, and unavailable-storage initialization.

- [ ] **Step 2: Run the shared UI tests and verify they fail**

  Run: `bun --filter '@scs/ui' test`

  Expected: FAIL because the new exports and stylesheet do not exist.

- [ ] **Step 3: Implement the shared theme primitives**

  Preserve the existing `next-themes` behavior and error-page visibility contract. Make `ThemeToggle` support icon-only and labeled placements without encoding app-specific positioning. Keep the initialization script self-contained so `global-error.tsx` and `global-not-found.tsx` can use it without a provider.

- [ ] **Step 4: Implement the semantic theme stylesheet**

  Define the approved warm-neutral light palette and layered-charcoal dark palette for all current semantic tokens. Include `color-scheme`, visible focus defaults, touch manipulation, balanced headings, and reduced-motion rules; do not include app layout or public-asset references.

- [ ] **Step 5: Implement the generic feedback primitive**

  Render semantic heading and description content with caller-supplied actions. Keep product copy, links, retry callbacks, and full-document markup outside the primitive.

- [ ] **Step 6: Run the shared UI gate**

  Run: `bun --filter '@scs/ui' lint`

  Run: `bun --filter '@scs/ui' typecheck`

  Run: `bun --filter '@scs/ui' test`

  Expected: all declared tasks PASS.

- [ ] **Step 7: Commit the shared foundation**

  ```powershell
  git add packages/ui
  git commit -m "feat(ui): unify theme and feedback primitives"
  ```

### Task 3: Standardize Next.js Error and Not-Found Boundaries

**Files:**

- Modify or create: `apps/web/src/app/error.tsx`
- Modify: `apps/web/src/app/global-error.tsx`
- Create: `apps/web/src/app/not-found.tsx`
- Modify: `apps/web/src/app/global-not-found.tsx`
- Modify or create the matching four files under `apps/people/src/app`, `apps/projects/src/app`, and `apps/portal/src/app`
- Delete after migration: duplicated app-local `theme-init-script.tsx` and `error-page-flag.tsx` files under `components/custom/theme`
- Test: `packages/ui/tests/components.test.tsx`

**Interfaces:**

- Consumes: Task 2's `FeedbackState`, `ThemeInitScript`, and `ErrorPageFlag`.
- Produces: a complete, app-owned Next.js fallback hierarchy in all four apps with app-specific copy/actions and shared presentation contracts.

- [ ] **Step 1: Add contract assertions for fallback requirements**

  Extend repository or shared UI tests to assert every app contains `error.tsx`, `global-error.tsx`, `not-found.tsx`, and `global-not-found.tsx`; global files import global styles and render a full document; error files remain Client Components and expose retry.

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run: `bun test test/repository`

  Expected: FAIL because Web lacks `error.tsx` and `not-found.tsx`, and People/Portal lack `error.tsx`.

- [ ] **Step 3: Implement thin app-specific fallback adapters**

  Use shared primitives for exact duplicate presentation. Keep public apps' home/discovery actions distinct from Portal's dashboard/account actions. Preserve the experimental `globalNotFound` setting and all existing asset URL strings.

- [ ] **Step 4: Remove only superseded duplicate theme helpers**

  Trace all imports, replace them with `@scs/ui` exports, and delete the app-local helper only when `rg` shows no remaining consumer.

- [ ] **Step 5: Run fallback and build verification**

  Run the repository fallback test, then `bun --filter '<workspace>' typecheck` and `bun --filter '<workspace>' build` for Web, People, Projects, and Portal.

  Expected: all commands PASS and each production build recognizes the complete fallback hierarchy.

- [ ] **Step 6: Commit the fallback hierarchy**

  ```powershell
  git add apps packages/ui/tests test/repository
  git commit -m "feat(ui): standardize application fallback pages"
  ```

### Task 4: Refresh the Web Application Shell

**Files:**

- Create: `apps/web/src/components/layout/site-header.tsx`
- Create: `apps/web/src/components/layout/site-footer.tsx`
- Create: `apps/web/src/components/feedback/development-page.tsx`
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/views/home/Home.tsx` and other touched page imports
- Delete after consumer migration: `apps/web/src/components/custom/dev-page/DevPage.tsx`
- Create: `test/repository/application-shells.test.ts`

**Interfaces:**

- Consumes: Task 2 theme primitives and unchanged Web routes.
- Produces: `SiteHeader`, `SiteFooter`, and `DevelopmentPage`; a keyboard/mobile-accessible institutional shell without changing page routes.

- [ ] **Step 1: Write failing Web shell structure tests**

  Assert a skip link and `<main id="main-content">`, primary navigation labels and destinations, an accessible mobile-menu button, visible focus classes, theme provider/toggle use, and removal of viewport zoom restrictions.

- [ ] **Step 2: Run the shell test and verify it fails**

  Run: `bun test test/repository/application-shells.test.ts`

  Expected: FAIL because Web has no application navigation or theme provider.

- [ ] **Step 3: Implement the institutional header and footer**

  Use existing route labels, a restrained desktop header, and a button-controlled mobile menu that closes on destination selection and Escape. Do not add routes or reference assets that are not already present.

- [ ] **Step 4: Apply shared tokens and theme infrastructure**

  Import the Task 2 stylesheet, keep Web-specific Tailwind/font mapping local, set correct light/dark viewport colors, remove zoom-disabling metadata, and add the provider and toggle to the shell.

- [ ] **Step 5: Move the touched development-page composition out of `custom`**

  Preserve its behavior and copy while adopting semantic tokens and updating all imports. Do not migrate unrelated `views` modules in this task.

- [ ] **Step 6: Run the Web gate**

  Run: `bun --filter '@scs/web' lint`

  Run: `bun --filter '@scs/web' typecheck`

  Run: `bun --filter '@scs/web' build`

  Expected: all declared tasks PASS.

- [ ] **Step 7: Commit the Web shell**

  ```powershell
  git add apps/web test/repository/application-shells.test.ts
  git commit -m "feat(web): refresh the institutional shell"
  ```

### Task 5: Refresh the People Application Shell

**Files:**

- Create: `apps/people/src/components/layout/site-header.tsx`
- Create: `apps/people/src/components/layout/site-footer.tsx`
- Modify: `apps/people/src/app/layout.tsx`
- Modify: `apps/people/src/app/globals.css`
- Modify: `apps/people/src/components/custom/search/PeopleSearch.tsx`
- Delete after migration: `apps/people/src/components/custom/navbar/Navbar.tsx`
- Delete after migration: superseded files under `apps/people/src/components/custom/theme`
- Modify: `test/repository/application-shells.test.ts`

**Interfaces:**

- Consumes: shared theme controls and existing Staff, Students, profile, and search routes.
- Produces: a search-led People shell with keyboard-accessible desktop disclosure menus and a complete mobile menu.

- [ ] **Step 1: Add failing People navigation assertions**

  Assert Staff and Students menu triggers are buttons with expanded state, submenu destinations remain links, search retains an accessible label, mobile navigation exposes every desktop destination, and active-route styling has a non-color indicator.

- [ ] **Step 2: Run the shell test and verify it fails**

  Run: `bun test test/repository/application-shells.test.ts`

  Expected: FAIL because current dropdowns depend on mouse hover and mobile hides destinations.

- [ ] **Step 3: Implement the People shell and migrate shared theme imports**

  Keep search visually prominent, support Escape/outside-click menu dismissal, preserve every current URL, and move app-wide layout components out of `custom`.

- [ ] **Step 4: Apply shared tokens without flattening People content**

  Remove duplicated semantic token values from `globals.css`, retain only app/font/layout rules, and update viewport colors and zoom behavior.

- [ ] **Step 5: Run the People gate**

  Run: `bun --filter '@scs/people' lint`

  Run: `bun --filter '@scs/people' typecheck`

  Run: `bun --filter '@scs/people' build`

  Expected: all declared tasks PASS.

- [ ] **Step 6: Commit the People shell**

  ```powershell
  git add apps/people test/repository/application-shells.test.ts
  git commit -m "feat(people): improve directory navigation"
  ```

### Task 6: Refresh the Projects Application Shell

**Files:**

- Create: `apps/projects/src/components/layout/site-header.tsx`
- Create: `apps/projects/src/components/layout/site-footer.tsx`
- Modify: `apps/projects/src/app/layout.tsx`
- Modify: `apps/projects/src/app/globals.css`
- Delete after migration: `apps/projects/src/components/custom/navbar/Navbar.tsx`
- Delete after migration: `apps/projects/src/components/custom/ThemeToggle.tsx` and superseded local theme helpers
- Move and update: `apps/projects/tests/components/custom/theme-toggle.test.tsx` to the appropriate shared UI coverage or app shell coverage
- Modify: `test/repository/application-shells.test.ts`

**Interfaces:**

- Consumes: shared theme controls and existing Home, Search, People, Courses, Categories, and Topics routes.
- Produces: a discovery-focused Projects shell with accessible Browse disclosure and complete responsive navigation.

- [ ] **Step 1: Add failing Projects navigation assertions**

  Assert Browse supports keyboard activation and Escape dismissal, all discovery destinations remain reachable on mobile, the menu trigger communicates expanded state, and no transition uses `transition: all`.

- [ ] **Step 2: Run Projects UI tests and verify they fail**

  Run: `bun --filter '@scs/projects' test`

  Expected: FAIL until tests target the shared toggle and refreshed shell.

- [ ] **Step 3: Implement the Projects shell and shared-theme migration**

  Preserve route labels and the discovery hierarchy, replace the fixed-header spacer with layout-safe sticky navigation, and keep menu content bounded on narrow screens.

- [ ] **Step 4: Apply shared tokens and update viewport behavior**

  Remove duplicated token values, retain app-specific layout rules, use matching theme colors, and allow browser zoom.

- [ ] **Step 5: Run the Projects gate**

  Run: `bun --filter '@scs/projects' lint`

  Run: `bun --filter '@scs/projects' typecheck`

  Run: `bun --filter '@scs/projects' typecheck:test`

  Run: `bun --filter '@scs/projects' test`

  Run: `bun --filter '@scs/projects' build`

  Expected: all declared tasks PASS.

- [ ] **Step 6: Commit the Projects shell**

  ```powershell
  git add apps/projects test/repository/application-shells.test.ts
  git commit -m "feat(projects): refine discovery navigation"
  ```

### Task 7: Refresh the Portal Application Shell

**Files:**

- Create: `apps/portal/src/components/layout/portal-header.tsx`
- Move: `apps/portal/src/components/custom/page-shell/page-shell.tsx` to `apps/portal/src/components/layout/page-shell.tsx`
- Move: `apps/portal/src/views/home/Home.tsx` to `apps/portal/src/app/_components/portal-home.tsx`
- Move: `apps/portal/src/views/dashboard/Dashboard.tsx` to `apps/portal/src/app/dashboard/_components/dashboard.tsx`
- Move: `apps/portal/src/views/manage/Manage.tsx` to `apps/portal/src/app/admin/_components/admin-overview.tsx`
- Modify the corresponding `page.tsx` import adapters and every PageShell consumer
- Modify: `apps/portal/src/app/layout.tsx`
- Modify: `apps/portal/src/app/globals.css`
- Delete after migration: superseded files under `apps/portal/src/components/custom/theme`
- Create: `apps/portal/test/application-shell.test.ts`

**Interfaces:**

- Consumes: shared theme controls, current Portal routes, and existing permission-filtered dashboard destinations.
- Produces: `PortalHeader` and renamed `PageShell`/`PageHeader`; a persistent workspace navigation layer that does not infer or broaden authorization.

- [ ] **Step 1: Write failing Portal shell tests**

  Assert the public/auth shell exposes Portal Home and sign-in destinations, authenticated workspace links remain normal Next links, permission-specific dashboard items still depend on existing role helpers, the theme toggle is no longer a floating global control, and PageShell imports no longer use `components/custom`.

- [ ] **Step 2: Run Portal tests and verify they fail**

  Run: `bun --filter '@scs/portal' test`

  Expected: FAIL because the shared header and renamed shell do not exist.

- [ ] **Step 3: Implement the Portal header without changing authorization**

  Keep the header compact and usable on login/signup pages. Use only universally safe navigation in the root shell; retain role- and access-dependent destinations inside existing authenticated views.

- [ ] **Step 4: Move only touched route compositions and layout components**

  Preserve exports, runtime behavior, redirects, fetching, and copy. Update callers atomically and verify no removed path remains in `rg` output before deletion.

- [ ] **Step 5: Apply shared tokens and remove the floating theme control**

  Place the shared toggle in `PortalHeader`, preserve hydration behavior, set matching viewport colors, and allow zoom.

- [ ] **Step 6: Run the Portal gate**

  Run: `bun --filter '@scs/portal' lint`

  Run: `bun --filter '@scs/portal' typecheck`

  Run: `bun --filter '@scs/portal' test`

  Run: `bun --filter '@scs/portal' build`

  Expected: all declared tasks PASS and authentication/authorization tests remain unchanged.

- [ ] **Step 7: Commit the Portal shell**

  ```powershell
  git add apps/portal test/repository/application-shells.test.ts
  git commit -m "feat(portal): add a coherent workspace shell"
  ```

### Task 8: Build the Portal Editor Workspace Contract

**Files:**

- Create: `apps/portal/src/components/editor/editor-state.ts`
- Create: `apps/portal/src/components/editor/editor-workspace.tsx`
- Create: `apps/portal/src/components/editor/editor-status.tsx`
- Create: `apps/portal/src/components/editor/editor-section-nav.tsx`
- Create: `apps/portal/src/components/editor/review-changes.tsx`
- Create: `apps/portal/src/components/editor/advanced-json.tsx`
- Create: `apps/portal/src/components/editor/validation-summary.tsx`
- Move: `apps/portal/src/components/custom/json-editor/JsonEditor.tsx` to `apps/portal/src/components/editor/json-editor.tsx`
- Move: `apps/portal/src/components/custom/json-editor/JsonPreview.tsx` to `apps/portal/src/components/editor/json-preview.tsx`
- Create: `apps/portal/test/editor-state.test.ts`

**Interfaces:**

- Consumes: existing shadcn primitives, CodeMirror JSON support, Zod-backed domain validators, and unchanged mutation handlers supplied by each domain editor.
- Produces: `EditorSurface = 'edit' | 'review' | 'advanced'`; `EditorRecordStatus`; `EditorWorkspace<T>`; `requestEditorSurface(current, target)`; `createEditorState<T>(draft, published)`; guarded Apply/Discard/Stay JSON transitions; linked validation-summary contracts.

- [ ] **Step 1: Write failing editor-state transition tests**

  Assert Edit → Review → Edit preserves object identity and field values; opening Advanced JSON serializes the current draft; dirty JSON blocks a surface change until Apply, Discard, or Stay; invalid JSON cannot apply; Apply replaces the canonical draft only after domain validation; published data never becomes editable through a view switch; reduced-motion preference disables transition classes.

- [ ] **Step 2: Run the state tests and verify they fail**

  Run: `bun test apps/portal/test/editor-state.test.ts`

  Expected: FAIL because the editor workspace contract does not exist.

- [ ] **Step 3: Implement the pure editor state machine**

  Keep state transitions independent of React and HTTP so Project, Course, and Profile editors can reuse them without sharing domain schemas. Model dirty JSON departure as an explicit pending transition rather than a boolean side effect.

- [ ] **Step 4: Implement the workspace composition**

  Render one primary Edit/Review control and one secondary Advanced JSON disclosure. Keep record status separate from surface selection, preserve focus on the selected surface heading, reflect `view=edit|review|advanced` without triggering a server reload, and use only short opacity/transform transitions with a reduced-motion override.

- [ ] **Step 5: Implement validation and review primitives**

  Provide a linked error summary whose entries focus their fields, inline error slots, human-readable review rows with direct “Change” actions, and specific submit labels supplied by the domain editor. Do not expose generic “Save” or “Continue” labels.

- [ ] **Step 6: Implement guarded Advanced JSON**

  Keep View JSON available, gate Edit JSON by caller permission, announce parse/validation errors, and require Apply, Discard, or Stay before leaving dirty JSON. Preserve CodeMirror lazy loading.

- [ ] **Step 7: Run the Portal state and type gates**

  Run: `bun test apps/portal/test/editor-state.test.ts`

  Run: `bun --filter '@scs/portal' typecheck`

  Expected: PASS.

- [ ] **Step 8: Commit the editor workspace**

  ```powershell
  git add apps/portal/src/components/editor apps/portal/test/editor-state.test.ts
  git commit -m "feat(portal): add a guided editor workspace"
  ```

### Task 9: Migrate the Project Editor to the Guided Workflow

**Files:**

- Create: `apps/portal/src/components/projects/project-editor.tsx`
- Create: `apps/portal/src/components/projects/project-list.tsx`
- Create: `apps/portal/src/components/projects/project-review.tsx`
- Create: `apps/portal/src/components/projects/sections/project-basics-section.tsx`
- Create: `apps/portal/src/components/projects/sections/project-people-section.tsx`
- Create: `apps/portal/src/components/projects/sections/project-academic-section.tsx`
- Create: `apps/portal/src/components/projects/sections/project-links-section.tsx`
- Create: `apps/portal/src/components/projects/sections/project-source-section.tsx`
- Modify then delete after migration: `apps/portal/src/components/custom/project-management-page/ProjectManagementPage.tsx`
- Modify: project route `page.tsx` files under `apps/portal/src/app/user/projects` and `apps/portal/src/app/admin/projects`
- Create: `apps/portal/test/project-editor-state.test.ts`

**Interfaces:**

- Consumes: Task 8's editor workspace, existing `ProjectSchema`, permissions, data loaders, revision values, operation polling, and mutation APIs.
- Produces: guided project sections, a human-readable project review, read-only published comparison, and unchanged mutation payloads.

- [ ] **Step 1: Write failing project workflow tests**

  Assert a non-technical user starts in Edit Details, fields are grouped under Basics/People/Academic Context/Links/Source, Review Changes uses the canonical draft, “Compare with Published” never mutates the draft, JSON editing remains permission-gated, validation links target fields, and the final action is “Submit Project Changes.”

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run: `bun test apps/portal/test/project-editor-state.test.ts`

  Expected: FAIL against the current Draft/Published plus Form/View JSON/Edit JSON selector model.

- [ ] **Step 3: Extract list and form sections without changing data behavior**

  Move one responsibility at a time from `ProjectManagementPage.tsx`. Preserve normalization, lookup, permissions, locked fields, revision checks, idempotency, polling, PR status, archive/delete confirmation, and request payloads byte-for-byte where practical.

- [ ] **Step 4: Integrate Edit, Review, Published Comparison, and Advanced JSON**

  Use one canonical project draft and the Task 8 transition guard. Present published data only in review/comparison. Keep administrator capabilities conditional on existing permission helpers.

- [ ] **Step 5: Run existing and new project-operation tests**

  Run: `bun test apps/portal/test/project-editor-state.test.ts apps/portal/test/registry-operations.test.ts apps/portal/test/mutation-operation.test.ts apps/portal/test/project-data.test.ts`

  Run: `bun --filter '@scs/portal' typecheck`

  Expected: PASS with unchanged API contracts.

- [ ] **Step 6: Commit the Project editor migration**

  ```powershell
  git add apps/portal/src/components/projects apps/portal/src/app apps/portal/test
  git commit -m "feat(portal): simplify project editing"
  ```

### Task 10: Migrate the Course Editor to the Guided Workflow

**Files:**

- Create: `apps/portal/src/components/courses/course-editor.tsx`
- Create: `apps/portal/src/components/courses/course-list.tsx`
- Create: `apps/portal/src/components/courses/course-review.tsx`
- Create: `apps/portal/src/components/courses/sections/course-details-section.tsx`
- Create: `apps/portal/src/components/courses/sections/course-codes-section.tsx`
- Create: `apps/portal/src/components/courses/sections/course-departments-section.tsx`
- Create: `apps/portal/src/components/courses/sections/course-offerings-section.tsx`
- Modify then delete after migration: `apps/portal/src/components/custom/course-management-page/CourseManagementPage.tsx`
- Modify: course route `page.tsx` files under `apps/portal/src/app/academic/courses`
- Create: `apps/portal/test/course-editor-state.test.ts`

**Interfaces:**

- Consumes: Task 8's editor workspace, course schemas and role helpers, existing course/offering APIs, PR status, revision and operation behavior.
- Produces: guided course and offering sections, readable review/comparison, permission-gated JSON, and unchanged course/offering mutation payloads.

- [ ] **Step 1: Write failing course workflow tests**

  Assert Details/Codes/Departments/Offerings grouping, retained draft values across surfaces, explicit published comparison, linked validation messages, disabled JSON editing for unauthorized or published-only contexts, and specific “Submit Course Changes” and offering actions.

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run: `bun test apps/portal/test/course-editor-state.test.ts`

  Expected: FAIL until the shared workspace replaces the coupled selectors.

- [ ] **Step 3: Extract course and offering responsibilities**

  Preserve code normalization, department options, offering identity, staff roles, permission checks, request payloads, polling, and PR state while splitting the large component.

- [ ] **Step 4: Integrate the guided and advanced surfaces**

  Use the canonical draft contract; keep published course data read-only; ensure changing course or offering selection cannot silently discard dirty form or JSON data.

- [ ] **Step 5: Run Portal course and regression tests**

  Run: `bun test apps/portal/test/course-editor-state.test.ts apps/portal/test/registry-operations.test.ts apps/portal/test/mutation-operation.test.ts`

  Run: `bun --filter '@scs/portal' typecheck`

  Expected: PASS.

- [ ] **Step 6: Commit the Course editor migration**

  ```powershell
  git add apps/portal/src/components/courses apps/portal/src/app/academic apps/portal/test
  git commit -m "feat(portal): simplify course editing"
  ```

### Task 11: Migrate Public Profile Editing and Remove Superseded Controls

**Files:**

- Create: `apps/portal/src/components/profiles/public-profile-editor.tsx`
- Create: `apps/portal/src/components/profiles/public-profile-review.tsx`
- Create: domain-focused files under `apps/portal/src/components/profiles/sections`
- Modify then delete after migration: `apps/portal/src/components/custom/public-profile-page/PublicProfilePage.tsx`
- Delete after all consumers migrate: `apps/portal/src/components/custom/editor-view-controls/editor-view-controls.tsx`
- Modify: public-profile route `page.tsx` files under `apps/portal/src/app/account`, `apps/portal/src/app/user/me`, and `apps/portal/src/app/admin/users`
- Create: `apps/portal/test/public-profile-editor-state.test.ts`

**Interfaces:**

- Consumes: Task 8 workspace, existing profile schema, locked fields, identity/permission checks, revision and operation contracts.
- Produces: guided profile sections, readable review and published comparison, advanced JSON guard behavior, and no remaining old editor-mode selector.

- [ ] **Step 1: Write failing public-profile workflow tests**

  Assert guided sections use plain-language labels, locked fields explain why they cannot be edited, Review Changes retains all values, published comparison is read-only, JSON Apply/Discard/Stay behaves consistently, and admin/user routes retain their current permissions.

- [ ] **Step 2: Run focused tests and verify they fail**

  Run: `bun test apps/portal/test/public-profile-editor-state.test.ts`

  Expected: FAIL until profile editing adopts the workspace.

- [ ] **Step 3: Split profile sections and integrate the workspace**

  Preserve profile normalization, locked-field behavior, identity selection, revision protection, mutation payloads, polling, and PR status. Use specific submit copy and linked errors.

- [ ] **Step 4: Remove the superseded mode selector and old editor paths**

  Run `rg` for every old `components/custom` editor import, update callers, and delete only files with no remaining consumers.

- [ ] **Step 5: Run the complete Portal gate**

  Run: `bun --filter '@scs/portal' lint`

  Run: `bun --filter '@scs/portal' typecheck`

  Run: `bun --filter '@scs/portal' test`

  Run: `bun --filter '@scs/portal' build`

  Expected: all declared tasks PASS and the existing auth, registry, pagination, and operation tests remain green.

- [ ] **Step 6: Commit the Profile migration**

  ```powershell
  git add apps/portal
  git commit -m "feat(portal): simplify profile editing"
  ```

### Task 12: Document the Convention and Verify the Whole Repository

**Files:**

- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/ENVIRONMENT_VARIABLES.md` if verification reveals factual corrections
- Modify: only files required to fix failures caused by Tasks 1–11

**Interfaces:**

- Consumes: all earlier tasks.
- Produces: living architecture documentation and a fully verified repository state.

- [ ] **Step 1: Document monorepo UI ownership and route colocation**

  Add the finalized `packages/ui` primitive boundary, app-level `components/<responsibility>`, route-private `_components`, and incremental migration rule to `docs/ARCHITECTURE.md`.

- [ ] **Step 2: Run targeted semantic and interaction verification**

  Run the shell, theme, fallback, editor-state, keyboard, validation, authorization, and route-contract tests. Do not use screenshots or subjective visual comparison. Record any credential-dependent Portal boundary without inventing credentials.

- [ ] **Step 3: Confirm public assets are untouched**

  Run: `git diff 67173e7 -- apps/*/public`

  Expected: no output.

- [ ] **Step 4: Run the repository quality gate**

  Run: `bun run docs:check`

  Run: `bun run format:check`

  Run: `bun run lint`

  Run: `bun run typecheck`

  Run: `bun run typecheck:test`

  Run: `bun run test`

  Run: `bun run build`

  Run: `git diff --check`

  Expected: all declared gates PASS. A workspace without a declared task is reported as not applicable, never as a passing test.

- [ ] **Step 5: Review the final diff for accidental contract changes**

  Confirm no endpoint, route, environment name, binding, package export used by existing callers, public asset, authentication redirect, or permission check changed outside the approved design.

- [ ] **Step 6: Commit final documentation and verification fixes**

  ```powershell
  git add docs apps packages services test turbo.json
  git commit -m "docs: record application ui ownership"
  ```
