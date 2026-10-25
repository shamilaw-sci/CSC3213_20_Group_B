# Projects Showcase and Discovery

## Intent

Make the public Projects site feel like a showcase of departmental work rather
than a filter dashboard. Visitors should understand the kinds of work the
department produces, see representative recent projects immediately, and move
through readable collection paths without learning the registry schema.

The Computer Engineering projects site is an information-architecture
reference, not a visual template. This design borrows its progression from
showcase to collection to project while deriving every collection from the SCS
project contract.

## Schema Model

The shared `ProjectSchema` determines the information architecture:

- `projectType` is the controlled, single-valued primary classification.
- `categories` are required, flexible, many-to-many editorial collections.
- `tags` are optional topics and technologies.
- `status` describes lifecycle and is supporting metadata, not a primary
  collection.
- `course` and `courseOffering` connect course projects to the academic domain.
- `departments`, `academicYear`, `batch`, `groupNumber`, and `people` provide
  context without defining the main navigation hierarchy.
- `dates.lastUpdatedAt` supports a truthful recently updated section.
- `media.coverImage` and `media.icon` support project presentation.

The schema has no featured or popularity signal. The UI must not invent either
one from repository links, array order, or visual preference.

## Goals

- Lead with a visual, content-rich showcase instead of six simultaneous
  filters.
- Use project types as the primary browse collections.
- Make categories and topics useful secondary collection paths.
- Give every public collection and search result a readable path rather than a
  query-string URL.
- Keep all project links canonical under `/projects/[project_slug]` while
  preserving `/p/[project_slug]` as the short redirect.
- Keep course ownership with the department Web app rather than creating a
  second course directory inside Projects.
- Remain useful with today's small dataset and expand naturally as more valid
  project types, categories, topics, and media are published.

## Non-goals

- Do not change the shared project, course, or offering schemas.
- Do not modify the separate public-data repository in this work.
- Do not infer a project type, course, offering, popularity, or featured status
  from names or categories.
- Do not add Projects-owned course or offering directory routes.
- Do not add public assets or a new styling framework.
- Do not recreate the reference site's visual design or its exact hierarchy.

## Anti-goals

- No filter dashboard on the homepage.
- No user-facing `?key=value` discovery URLs.
- No duplicate ways to reach the same collection.
- No flat wall of every project before visitors understand the collection.
- No empty showcase sections or placeholder cards.
- No hardcoded colors in application TSX; use semantic theme tokens.

## Approaches Considered

### 1. Keep the unified query-driven directory

Keep every dimension as a filter on `/` and improve its styling. This preserves
the current implementation but continues to make the site feel like a registry
search tool rather than a public showcase.

### 2. Schema-led showcase with path-based collections — selected

Use project types as the primary showcase collections, categories and topics as
secondary collections, a separate all-projects directory, and a dedicated
search path. This reflects the schema without exposing every field as a route.

### 3. Give every project field a directory

Add routes for status, department, academic year, batch, people, courses,
offerings, categories, tags, and types. This is technically complete but
recreates the navigation complexity the redesign is intended to remove.

## Canonical Routes

The Projects app owns these routes:

| Path                                 | Purpose                                               |
| ------------------------------------ | ----------------------------------------------------- |
| `/`                                  | Showcase homepage                                     |
| `/browse`                            | All projects directory                                |
| `/browse/page/[page]`                | Bounded all-projects pages                            |
| `/types/[type]`                      | One controlled project-type collection                |
| `/types/[type]/page/[page]`          | Bounded project-type pages                            |
| `/categories/[category]`             | One category collection                               |
| `/categories/[category]/page/[page]` | Bounded category pages                                |
| `/topics/[topic]`                    | One tag/topic collection                              |
| `/topics/[topic]/page/[page]`        | Bounded topic pages                                   |
| `/search/[query]`                    | Search results for one encoded search phrase          |
| `/search/[query]/page/[page]`        | Bounded search-result pages                           |
| `/projects/[project_slug]`           | Canonical project detail                              |
| `/p/[project_slug]`                  | Permanent short-link redirect to the canonical detail |

Project-type path segments use an explicit stable mapping rather than exposing
enum casing directly: `course-projects`, `research-projects`,
`student-innovations`, `open-source`, `department-systems`, `datasets`,
`publication-artifacts`, `industry-collaborations`,
`faculty-collaborations`, `hackathons`, and `other`.

Category and topic segments use one shared Unicode-safe canonicalizer. Links,
route matching, sitemap generation, and tests must use the same helper. Invalid
or nonexistent collection segments return the application not-found surface.

The canonicalizer applies NFKC normalization, locale-independent lowercase,
trims surrounding whitespace, replaces whitespace and URL path delimiters with
single hyphens, and preserves Unicode letters and numbers. Values that resolve
to the same segment are treated as the same logical collection and their counts
are combined. Project types are schema-valid even when they currently contain
no projects; category and topic paths are valid only when derived from at least
one published project. Only non-empty collections are listed in the sitemap.

Search submits by navigation to an encoded `/search/[query]` path. Empty search
submissions go to `/browse`. Before encoding, search input is NFKC-normalized,
trimmed, and whitespace or path separators become single hyphens. Other
reserved characters are percent-encoded, so searches such as `C++` and `C#`
remain representable without a query string. Discovery controls must not emit
query strings.

Legacy query-string discovery state is not preserved. A request carrying old
discovery parameters redirects to the same route without those parameters;
multi-filter state is intentionally discarded rather than translated into a
second URL model.

## Course Ownership

Projects displays available course code, title, academic year, and semester as
project context. It does not own `/courses` or `/offerings` routes.

When the department Web app exposes a known course destination, course links
go there. Until Web owns a stable per-course route or the shared contract
publishes a canonical course URL, Projects links only to a known Web course
index; otherwise course metadata remains readable text. Projects must not infer
undergraduate or postgraduate ownership from a course code.

For the current Web route surface, the Projects footer may link directly to the
Web app's Undergraduate Courses and Postgraduate Courses indexes. Individual
project records render course metadata as text until Web provides a stable
per-course destination.

## Homepage Showcase

The homepage answers four questions in order:

1. **What is this?** A concise department-project introduction.
2. **What can I explore?** Project-type collection cards generated only for
   types present in published data.
3. **What changed recently?** A bounded row of projects ordered by the required
   `lastUpdatedAt` value.
4. **What other areas exist?** Compact category and topic links generated from
   published data, with an obvious route to `/browse`.

Search remains prominent in the opening section but does not push the showcase
below a large filter form. The homepage does not render status, person, course,
batch, year, or department controls.

Sections with no valid records are omitted. The type order is deliberate and
stable, but a type card appears only when at least one project has that exact
schema value. `OTHER` remains honest and visible when published records use it;
the UI does not silently reinterpret `coursework` categories as course
projects.

## Collection Pages

All collection pages share one route-owned composition:

- breadcrumb back to Home and `/browse`; no empty `/types`, `/categories`, or
  `/topics` index routes are added solely for breadcrumbs;
- clear collection title, plain-language description, and project count;
- a bounded project grid;
- path-based Previous and Next links when another page exists;
- nearby cross-links to useful types, categories, or topics;
- a collection-specific empty or not-found state.

`/browse` provides the complete directory and lightweight links to the
available type, category, and topic collections. It is not another six-control
dashboard. Status and other contextual values remain visible on cards and
details without becoming competing global directories.

## Project Cards

Showcase and collection cards prioritize:

1. cover image when provided, otherwise the declared icon in a semantic
   fallback surface;
2. project title;
3. concise description;
4. project type and status;
5. one useful academic context line when available;
6. at most two category or topic labels.

The whole card has one canonical project link. There is no nested View button.
Cards use stable aspect ratios, bounded text, visible keyboard focus, semantic
hover states, and no interaction that exists only on hover.

## Project Detail

The detail page keeps the existing project-centered structure and adds
collection-aware navigation:

- breadcrumb to Home and the project's type collection;
- title, description, type, status, media, and external actions;
- project-scoped people and their exact published roles;
- categories and topics linked to their path-based collections;
- course information linked according to the Course Ownership rules;
- departments, academic year, batch, group, and dates only when present;
- related projects selected from shared type, category, or topic values;
- no empty related section and no inferred global role for a person.

## Header and Footer

The header provides direct links to Home and Browse plus the theme control.
These destinations remain visible at narrow widths; a mobile sheet is not
needed for two primary links. The active destination has an accessible current
state.

The footer links to Browse and currently available type collections. It does
not hardcode category or topic values that may disappear from published data.
Course navigation belongs to the department Web app.

## Loading, Empty, and Error States

- Homepage loading mirrors the intro, type cards, recent row, and secondary
  collection links.
- Collection loading mirrors the breadcrumb, summary, and bounded card grid.
- Detail and short-link loading retain the project-detail skeleton.
- Missing collections use not-found; valid empty collections explain why no
  records are currently published.
- Data failures provide retry without replacing the current route.

## Metadata and Indexing

- The sitemap contains Home, Browse, every valid type/category/topic
  collection, bounded collection pages when needed, and canonical project
  details.
- Search-result and short-link routes are excluded from the sitemap.
- Collection metadata uses the resolved human label and count.
- Canonical URLs never include discovery query parameters.

## Accessibility and Visual Rules

- Use semantic headings and landmarks with one page-level `main` from the root
  layout.
- Preserve visible focus, keyboard operation, reduced-motion preferences, and
  minimum touch targets.
- Use semantic theme tokens for text, surfaces, borders, focus, and state.
- Do not use embedded color utilities or color values in application TSX.
- Do not rely on cover imagery for project identity; icon and text fallbacks
  must remain complete.
- Keep layouts readable under text zoom, long titles, Unicode categories, and
  narrow screens.

## Testing and Verification

- Pure tests cover route builders, type mappings, Unicode collection segments,
  search paths, page bounds, counts, recent ordering, and related-project
  selection.
- Component tests cover homepage section priority, omission of empty sections,
  single-link cards, and external course-link behavior.
- Route tests cover every canonical path, not-found behavior, pagination,
  sitemap membership, and the `/p/[project_slug]` redirect.
- Architecture tests prohibit legacy query-string discovery links and
  Projects-owned course routes.
- Run the Projects workspace gate, `bun run test:repo`, Knip, and the complete
  monorepo gate before committing.

## Implementation Calls Left to the Builder

- Choose route-private versus shared Projects compositions according to the
  repository ownership rules.
- Reuse the validated public project adapter and pure domain helpers; do not
  create parallel project types.
- Keep collection data derived at runtime/build time from published records so
  adding a valid type, category, or topic does not require editing navigation
  source.
- Preserve application independence and use alias imports for cross-directory
  modules.
