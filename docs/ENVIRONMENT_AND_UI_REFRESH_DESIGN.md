# Environment Audit and UI Refresh Design

## Objective

Audit every environment variable and Cloudflare binding in the monorepo, make
its ownership and runtime use explicit, and close gaps between code, local
templates, deployment configuration, and documentation. Refresh all four
application interfaces so they share a deliberate SCS visual identity while
retaining navigation and layout suited to each application's purpose.

The change must preserve routes, public and internal contracts, authentication
behavior, deployment boundaries, and existing product capabilities.

## Scope

The environment audit covers:

- `apps/web`, `apps/people`, `apps/projects`, and `apps/portal`;
- `services/api`, `services/github-app`, and `services/mailer`;
- local environment templates, typed configuration, Wrangler variables,
  secrets, Cloudflare bindings, deployment-only variables, tests, workflows,
  and the canonical environment catalog.

The interface refresh covers the complete shells of Web, People, Projects, and
Portal, including theme tokens, typography, global surfaces, navigation,
responsive behavior, focus treatment, and theme controls. It does not rewrite
unrelated feature workflows or application content.

Public assets, favicon files, manifests, and existing asset URLs are excluded
from this change.

## Environment Audit

### Inventory Model

Every configuration name will be recorded with these attributes:

| Attribute     | Meaning                                                                 |
| ------------- | ----------------------------------------------------------------------- |
| Owner         | The independently deployable workspace that consumes the value          |
| Kind          | Browser value, server value, secret, platform binding, or adapter value |
| Declaration   | Typed schema or Worker binding interface                                |
| Supply        | Example file, Wrangler configuration, provider setting, or binding      |
| Consumer      | Runtime code path that reads or receives the value                      |
| Documentation | Canonical catalog entry and any operational instructions                |
| Status        | Used, deployment-only, binding-only, or unused                          |

An environment name is considered used only when application code consumes it,
the runtime platform or deployment adapter consumes it, or it represents a
binding received by a Worker. Merely appearing in a template, type, test, or
documentation does not establish runtime use.

### Reconciliation Rules

- Keep used values and bindings, with typed validation at the owning boundary.
- Keep deployment-only values when the named adapter or provider consumes them;
  document that distinction instead of pretending application code reads them.
- Remove a variable only after tracing all runtime, deployment, workflow, and
  compatibility consumers.
- Preserve current names and defaults when removal or renaming could break a
  deployment. Any required contract-breaking cleanup is excluded and must be
  proposed separately for approval.
- Ensure each locally configurable value appears in the owning safe example
  file and every supported value appears in the canonical catalog.
- Extend repository tests to compare the catalog, templates, typed
  configuration, and deploy-time declarations where practical, preventing
  silent drift.
- Declare build-affecting application variables in the appropriate Turborepo
  tasks so cached output cannot be reused across incompatible environments.

### Deliverable

`docs/ENVIRONMENT_VARIABLES.md` remains the canonical setup guide and will gain
a concise audit matrix that distinguishes runtime values, bindings, and
deployment-only settings. Tests will encode the mechanically verifiable parts
of that matrix.

## Interface Direction

### Shared Identity, Purpose-Built Shells

All four apps will share a visual system rather than an identical layout. The
system uses restrained university colors, neutral surfaces, consistent
typography and spacing, and common interaction states. Navigation remains
owned by each app because the apps serve different tasks:

- Web uses an institutional site header with clear primary sections and access
  to the related SCS applications.
- People prioritizes search and simple Staff and Students discovery.
- Projects prioritizes project discovery, categories, courses, and search.
- Portal uses a compact authenticated workspace shell that clearly separates
  personal, academic, and administrative destinations.

This keeps the applications recognizably related without making public sites
look like administration software or flattening the Portal into a marketing
header.

### Monorepo UI Ownership

The monorepo keeps deployable applications as independent package-graph
endpoints. Shared shadcn primitives and primitive-level theme infrastructure
belong in `packages/ui`; composed product interfaces remain in their owning
application.

Within each Next.js application:

- `app` owns routes, layouts, metadata, server-side orchestration, and Next.js
  special files;
- route-private compositions live in a colocated `_components` folder;
- app-wide shells and compositions reused by multiple routes live in
  `components`, grouped by responsibility or feature;
- `lib` owns data access and non-visual application helpers;
- the meaningless `components/custom` layer is removed from files touched by
  the refresh;
- route-shaped modules in `views` move to their owning route, while modules
  reused across routes move to a named app-level feature folder.

The migration is incremental and limited to the interface surfaces affected by
this work. It does not perform a blind repository-wide file move.

### Visual Language

- Use deep aubergine or maroon as the primary institutional hue and reserve
  warm gold for emphasis, focus, and small highlights.
- Use warm neutral light surfaces and layered charcoal dark surfaces. Dark mode
  avoids pure black, low-contrast gray-on-gray, and large saturated panels.
- Reduce unnecessary card borders and shadows. Layout, spacing, dividers, and
  typography should provide hierarchy before decoration.
- Use readable text sizes and balanced headings rather than oversized hero
  text. Preserve Open Sans unless a font change proves necessary and safe.
- Avoid gradients, glass effects, excessive pills, ornamental metrics, generic
  dashboard tiles, and motion without a functional purpose.

### Navigation and Responsive Behavior

- Use semantic links for destinations and buttons for actions.
- Show a clear active destination with more than color alone where practical.
- Provide keyboard-operable desktop navigation and a real mobile menu rather
  than hiding destinations or depending on hover.
- Keep primary controls at least touch-friendly size, add visible focus states,
  and ensure sticky navigation does not hide focused content.
- Preserve current URLs and labels unless a label is demonstrably misleading.
- Keep People and Projects search prominent without crowding narrow screens.
- Place the theme control consistently in the shell and give icon-only controls
  an accessible name.

### Theming and Rendering

The four apps will align their semantic CSS tokens for background, foreground,
card, popover, primary, secondary, muted, accent, border, input, ring, and
sidebar surfaces. Tokens may remain in each app so deployables stay independent;
shared shadcn primitives remain in `packages/ui`, while composed headers and
navigation stay in their owning apps.

Theme initialization must remain hydration-safe. Each app will provide a
matching browser `theme-color`, native dark color scheme, reduced-motion
behavior, and no viewport setting that disables zoom.

The reusable theme provider, initialization logic, toggle primitive, and
semantic token stylesheet live in `packages/ui`. Each application retains the
placement of theme controls, metadata colors, and any deliberate product-level
token overrides.

### Error and Not-Found Surfaces

Every application uses the complete Next.js fallback hierarchy:

- `error.tsx` handles recoverable uncaught errors below the root layout and
  offers a retry action;
- `global-error.tsx` is the last-resort root-layout boundary and renders its own
  document and theme initialization;
- `not-found.tsx` handles missing domain records raised through `notFound()`;
- `global-not-found.tsx` handles completely unmatched URLs while the existing
  experimental convention remains enabled.

The Next.js special files stay inside every app, but delegate presentation to
shared primitive-level feedback UI where that removes exact duplication. Copy,
destinations, and product-specific actions remain app-owned. Expected failures
such as validation, authorization, and unavailable upstream data remain
explicit application states rather than being converted into thrown errors.

## Compatibility and Failure Handling

- No endpoint, route, environment name, binding, or component export will be
  removed without verified absence of consumers.
- Authentication and authorization redirects remain unchanged.
- Navigation enhancements degrade to normal links if client-side behavior is
  unavailable.
- Existing loading, error, and empty states remain functional and receive only
  visual changes needed for consistency or accessibility.
- Data fetching and service boundaries are not moved into shared UI code.

## Verification

Environment work will use repository policy tests plus focused configuration
tests for each affected service. UI work will add or update focused navigation
and theme tests, then exercise representative desktop and mobile flows in all
four apps.

For every affected workspace, run only its declared lint, typecheck,
typecheck:test, test, and build tasks. Before completion, run the repository
documentation, formatting, lint, typecheck, typecheck:test, test, build, and
`git diff --check` gates. Any credential-dependent runtime boundary will be
reported explicitly rather than described as verified.

## Explicit Non-Goals

- Changing public URLs, APIs, schemas, authentication providers, or deployment
  topology.
- Moving composed product navigation into `packages/ui`.
- Redesigning every feature page or rewriting application copy.
- Adding a new CSS framework, component system, analytics product, or runtime
  dependency solely for this refresh.
- Consolidating, regenerating, deleting, or otherwise modifying public assets,
  favicons, manifests, or their published URLs.
