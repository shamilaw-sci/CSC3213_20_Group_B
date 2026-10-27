---
title: UI theme and accessibility
description: Semantic color roles, light and dark tokens, theme hydration, standalone errors, focus, touch, motion, and contrast verification.
---

# UI theme and accessibility

`theme.css` defines semantic roles rather than component-specific or raw
palette utility names. Both `:root` and `.dark` provide the same contract:
background and foreground, card and popover, primary, secondary, muted,
accent, status colors and surfaces, borders, input, focus ring, overlay,
charts, and sidebar roles.

Components consume roles such as `bg-card`, `text-muted-foreground`, and
`border-warning-border`. Product TSX files must not embed literal color values.
When a new semantic state is genuinely shared, add a complete light and dark
token family and verify contrast instead of borrowing a visually similar role.

## Theme lifecycle

The shared `ThemeProvider` configures `next-themes` to use a class, follow the
system by default, and disable transitions during a mode change. The normal
application layout owns that provider.

Standalone global error pages cannot rely on the hydrated provider. The
`ThemeInitScript` reads an explicit `light` or `dark` preference when storage is
available, otherwise follows the system preference, applies `.dark` before
hydration, and listens for system and cross-tab storage changes. It intentionally
falls back safely when storage or media-query APIs fail.

The theme toggle exposes one labelled button contract, uses the resolved theme,
and hides itself when the root marks a standalone error page. Apps may choose
icon-only or labelled presentation through its supported props; they should not
fork theme state locally.

## Global interaction contract

The theme stylesheet supplies a visible focus outline for interactive elements,
touch manipulation for links and buttons, balanced major headings, and a
reduced-motion override that collapses animation and transition duration. UI
tests verify every required semantic token exists in both themes, foreground
pairs meet WCAG 4.5:1, and the focus ring meets 3:1 against the page background.

Those automated pairs are the minimum contract, not proof that every composed
screen is accessible. Application review must still cover hover, selected,
disabled, error, narrow-layout, and keyboard states as described in
[UI quality assurance](../../UI_QUALITY_ASSURANCE.md).
