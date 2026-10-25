# Project Discovery Simplification

## Intent

Make the public Projects site immediately understandable to students, staff,
and visitors who may not know the registry's internal vocabulary. A visitor
should be able to search or browse from the first screen, understand what each
result represents, and reach useful project details without choosing between
overlapping navigation paths.

## Goals

- Make the home page the single canonical **Find Projects** experience.
- Let visitors search by title, course, person, technology, year, status, or
  category from the same experience.
- Use consistent reader-facing terms: **Categories**, **Topics**, **Courses**,
  and **People**.
- Reduce visual and copy noise in navigation, project cards, result summaries,
  and project details.
- Keep search and filter state shareable in the URL.
- Preserve the published project entity contract and independent deployment of
  `apps/projects`; compatibility with the site's old discovery routes and
  query names is explicitly not required.

## Non-goals

- Do not change project entity schemas, public JSON projections, or service
  APIs unless the implementation proves a contract change is required.
- Do not add project editing or authentication to the public site.
- Do not change public asset ownership or introduce new illustration assets.
- Do not remove canonical project detail URLs. Add `/p/[project_slug]` as the
  only intentional short URL; it permanently redirects to
  `/projects/[project_slug]` and is not a second rendering path.
- Do not introduce a new CSS framework or duplicate shared shadcn primitives.

## Anti-goals

- Do not replace the current confusion with a dashboard full of controls.
- Do not expose registry terms such as “facets” or alternate between
  “collections/categories” and “tags/topics.”
- Do not display missing values as “Optional”; omit nonessential missing facts
  or use “Not provided” only when the absence is important.
- Do not make cards fully decorative or hide essential project identity behind
  icons, hover states, or unexplained badges.
- Do not add another competing navigation layer.

## Constraints

- All project data continues to come from the published public-data service.
- Browser code remains inside `apps/projects`; shared packages keep their
  existing ownership boundaries.
- Product compositions remain app-owned, while controls continue to use
  `@scs/ui` primitives and semantic theme tokens.
- The remaining Next.js routes, metadata, loading states, error states, and
  static/dynamic rendering boundaries must continue to build independently.
- Implementation uses aliases for cross-directory imports.

## Approaches Considered

### 1. Polish the existing five-destination model

Keep Search, People, Courses, Categories, and Topics equally prominent and
improve their copy and styling.

This is the lowest-risk change, but it leaves visitors to understand the
difference between overlapping search modes before they can begin. It treats
the symptom rather than the information architecture.

### 2. Make one unified discovery flow primary

Use **Find Projects** as the primary route and surface, but retain secondary
directory routes.

This gives new visitors one obvious starting point, but leaves duplicated route
compositions, terminology, loading states, and navigation paths to maintain.

### 3. Replace legacy discovery routes with one canonical home — selected

Make `/` the complete search-and-browse experience. Remove `/search`,
`/find-by`, `/categories`, `/topics`, `/courses`, and their filtered child
routes instead of maintaining redirects or compatibility wrappers. Keep only
canonical project detail routes under `/projects/[project_slug]`, plus the
explicit `/p/[project_slug]` permanent-redirect shortcut.

This creates one mental model and one implementation. Category, topic, course,
status, type, and person links point back to the home page with canonical query
parameters. The page must progressively disclose its filters so it still feels
like a public directory rather than an administrative dashboard. The user
explicitly chose removal over legacy-route preservation.

## Information Architecture

### Global header

The header contains the SCS Projects brand/home link and the theme control. It
does not need a second home link or a mobile navigation sheet when there are no
competing discovery destinations. Project detail pages use the same header and
provide their own clear return path to Find Projects.

### Home page

The home page is also the complete discovery page. It answers three questions
in order:

1. **What is this?** A directory of student, research, and departmental work.
2. **How do I find something?** A prominent search field with examples and
   immediately understandable filters.
3. **What is available?** The matching project count and project results.

With no search or filters, the results section is **All Projects**, ordered by
the registry's existing most-recently-updated order. Do not infer “featured”
status because the data contract has no editorial featured field.

### Find Projects experience

The page is a discovery surface, not an empty search form.

- With no query or filters, load the published project list and label it
  **All Projects**.
- Place a full-width search field first. Its visible label is **Search
  Projects**, and helper copy gives concrete examples.
- Provide secondary filters for Category, Topic, Course, Status, and Project
  Type. Use the existing shadcn `Select` control for longer option sets.
- Store `q`, `category`, `topic`, `course`, `status`, `type`, and `person` in URL query
  parameters. Submitting or changing a filter updates the URL.
- Store the current result page in the canonical `page` query parameter. Show
  12 projects per page with Previous and Next navigation. Changing or clearing
  any discovery filter resets `page` to 1.
- Show active filters as removable, clearly labeled controls and provide one
  **Clear Filters** action when any filter is active.
- Announce result-count changes with a polite live region.
- Use singular/plural result copy correctly and avoid punctuation fragments
  such as “Showing 1 projects.”
- General search includes a person's name, username, email, and student number.
  The optional Person filter performs an exact normalized username match. There
  is no second person-search page.

### Removed legacy discovery surfaces

Remove the route folders and app-owned compositions for Search, Find by
Username, Categories, Topics, Courses, and their filtered result pages. Remove
the repeated facet rail and legacy browse tiles. Update the sitemap, metadata,
footer, project cards, project details, empty states, and related-project links
so they emit only `/`, `/projects/[project_slug]`, and canonical home query
URLs. Do not add redirects, aliases, or hidden compatibility exports.
The sole exception is the approved `/p/[project_slug]` short-link redirect.

Remove data-adapter and server-query functions that exist only for the deleted
routes, including separate free-text search, exact-username projection lookup,
legacy category/topic result helpers, and unused registry-stat exports. Keep
only helpers consumed by the canonical home and project-detail experiences.

## Project Cards

Each result card has one navigation target and a stable reading order:

1. Project title.
2. Two-line short description.
3. Project type and status.
4. One concise context row containing course or academic year when present.
5. At most 2 topic labels when topics add useful context.

Remove the nested-looking **View** button; the card itself is the link and gets
a visible hover and focus treatment. Keep the icon decorative and hide it from
assistive technology. Do not render “No academic year” as a badge. Long titles,
descriptions, topic names, and identifiers must wrap or truncate predictably.

## Project Detail Page

- Add a small breadcrumb/back link to `/` before the title.
- Keep project title, concise description, status/type, and available external
  actions in the header.
- Use plain section labels: **About This Project**, **People**, **Categories and
  Topics**, and **Project Details**.
- Show a person's role only within that project; do not infer a global role.
- Omit absent Course, Departments, Batch, and Academic Year rows instead of
  saying “Optional.”
- Format the last-updated date with `Intl.DateTimeFormat`.
- Show Related Projects only when matches exist; do not render an empty panel.

## Interaction and Responsive Behavior

- Desktop and mobile expose the same single discovery destination and
  terminology without a redundant mobile menu.
- Search controls stack on narrow screens without horizontal scrolling.
- Filters remain usable with keyboard, touch, and screen readers.
- Links remain links so modifier-click and browser navigation work.
- Interactive states use semantic theme colors and increase contrast on hover,
  active, and focus states.
- Motion is limited to short transform/opacity feedback and respects reduced
  motion.

## Loading, Empty, and Error States

- Page-specific skeletons mirror the new search controls, result summary, and
  card geometry.
- Loading copy uses the ellipsis character where visible.
- Empty results explain that the current filters produced no matches and offer
  **Clear Filters** back to the canonical unfiltered home.
- Data failures preserve entered URL state and offer retry without navigating
  away.
- The root loading skeleton must not retain the removed hero actions, browse
  tiles, Featured section, or View-button geometry.

## Metadata and Indexing

- The sitemap contains only `/` and canonical project detail URLs.
- Short `/p/[project_slug]` redirects are not listed in the sitemap.
- Root metadata describes the combined search-and-browse experience.
- Remove feed alternate links that do not have corresponding routes.
- Filtered query URLs remain usable and shareable but are not expanded into
  separate sitemap entries.

## Testing and Verification

- Replace the legacy header tests with tests for the simplified header and the
  absence of a redundant mobile menu.
- Add query-state tests covering canonical parameter names, combined filters,
  exact person filtering, pagination, page reset after filter changes, clearing
  filters, and singular/plural result labels.
- Add component tests for card information priority and removal of the
  redundant View control.
- Add detail tests for omitted missing metadata and project-scoped contributor
  roles.
- Add route/architecture tests proving superseded discovery pages, components,
  compatibility exports, sitemap entries, and metadata alternates are removed.
- Run the Projects workspace lint, production/test typechecks, tests, and build.
- Run Knip and the repository-wide documentation, formatting, lint, typecheck,
  test, build, and diff checks before completion.

## Implementation Calls Left to the Builder

- Choose the smallest app-owned component boundaries that avoid duplicating
  search controls and result summaries.
- Reuse the existing cached public-data adapter; add only pure query helpers
  needed to keep URL parsing, filtering, pagination, and labels testable.
- Delete route-level metadata, loading files, and components owned only by
  removed routes. Keep the home and project-detail loading/error geometry
  specific to those pages.
- Prefer existing shared primitives. Add a shared primitive only if it is
  generic and used beyond this product workflow.
