---
title: UI quality assurance
description: Durable review standards for accessible, responsive, consistent, and understandable interfaces across every application.
---

# UI quality assurance

Use this guide for interface changes in Web, People, Projects, Portal, and the
documentation site. It defines the product qualities to preserve; it is not a
record of a particular redesign or screenshot comparison.

## Review the user task first

Start from the task a person is trying to complete, not from individual
components. A first-time visitor should understand the page purpose, the
primary action, and the next useful destination without knowing the repository
or its data model. Keep expert controls available without making them the
default path for non-technical users.

- Use plain, domain-accurate labels. Do not expose schema field names as UI
  copy when a clearer human label exists.
- Present each fact once in its most useful context. Do not repeat actions such
  as Edit or Sign out at both the top and bottom of one view.
- Keep view changes, tabs, filters, and editor modes visually stable. The
  selected control must not shift because its border, weight, or padding
  changes.
- Explain ambiguous values with a label or nearby context. A bare subject,
  department, role, or status badge is not sufficient when its meaning is not
  obvious.
- Do not invent or collapse roles. Show the relationship represented by the
  source data, and support multiple roles when the contract permits them.

## Navigation and information architecture

Each application owns its product navigation while following the shared shell
and interaction conventions in [UI system](UI_SYSTEM.md).

- Use a real Next.js `Link` for internal navigation and normal document
  navigation for cross-origin destinations.
- Mark the current destination with a visible state and `aria-current` where
  applicable.
- Keep authentication actions state-aware. Signed-out users should not see
  account-only actions, and signed-in users should have one predictable way to
  sign out.
- On mobile, group destinations by user intent, keep the menu scrollable, and
  preserve access to the theme control and account action without duplicating
  them.
- Prefer readable route paths for stable browse states. Query parameters are
  appropriate for transient search and filter state, not as a substitute for
  the application information architecture.

## Layout and responsive behavior

Verify content at narrow mobile, wide mobile, tablet, and desktop widths.
Layouts must work with zoomed text and unusually long real data, not only short
fixtures.

- Interactive targets should be at least 44 by 44 CSS pixels unless an inline
  text-link pattern makes that impractical.
- Segmented controls and tabs must use equal vertical alignment, consistent
  padding, and a selected treatment that does not alter their outer size.
- Replace cramped trailing View buttons on small cards with a clear
  card-level link or an affordance that remains aligned at narrow widths.
- Prevent horizontal page scrolling. Allow bounded data regions, code blocks,
  and tables to scroll independently when necessary.
- Keep content widths and spacing tokens consistent within an application;
  avoid arbitrary one-off offsets used to correct a single viewport.

## Theme, color, and typography

Use semantic tokens from `@scs/ui`. Literal palette classes or color values do
not belong in TSX class strings. A component must remain legible in both light
and dark themes and through hover, focus, active, selected, disabled, and
loading states.

- Text and interactive controls should meet WCAG AA contrast requirements.
- Hover and pressed states must not reduce text contrast or make an action look
  disabled.
- Focus indicators must remain visible against every supported surface.
- Theme controls need an understandable accessible name and a stable target;
  their hover state must use semantic foreground and background tokens.
- Use the repository typography configuration. Do not load an app-local font
  merely to approximate a screenshot.

## Loading, empty, error, and transition states

Every data-dependent page needs states that preserve its structure and explain
what the user can do next.

- Use a page-specific skeleton that resembles the final hierarchy rather than
  a generic spinner or unrelated card grid.
- Keep view-switch controls in place while their content changes. Use pending
  feedback without clearing the whole page when the existing content can
  remain visible.
- Distinguish no results, no published data, authorization failures, not found,
  and service failures. Each message should offer an appropriate next action.
- Provide route-level loading and error boundaries plus application-level 404
  and global error fallbacks.
- Respect reduced-motion preferences and avoid animation that delays or hides
  the result of a direct action.

## Accessibility checks

- Navigate every interactive path with a keyboard only.
- Confirm logical focus order, visible focus, escape behavior, and focus return
  for menus, dialogs, sheets, and popovers.
- Use one page heading and a meaningful heading hierarchy.
- Give icon-only controls an accessible name; hide decorative icons from the
  accessibility tree.
- Associate validation messages with their fields and announce asynchronous
  success or failure where appropriate.
- Verify browser zoom at 200 percent and text spacing without loss of content
  or functionality.

## Verification workflow

Run the owning workspace's lint, typecheck, test, and build commands. Lint
enforces Tailwind class ordering and canonical classes, but it does not prove
that the interaction is understandable or accessible.

For a changed route, manually verify:

1. Signed-out and signed-in states when authentication affects the page.
2. Light and dark themes, including every interactive state touched by the
   change.
3. Keyboard navigation and screen-reader names for changed controls.
4. Narrow and wide layouts with representative long content.
5. Loading, empty, error, and successful states.
6. Internal navigation without a full reload and cross-origin navigation
   without an RSC or CORS failure.
7. The browser console for hydration, accessibility, and runtime errors.

Keep screenshot comparisons, temporary findings, and machine-local evidence in
the change review or issue that owns them. Promote only lasting rules or
verified architectural decisions into this handbook.
