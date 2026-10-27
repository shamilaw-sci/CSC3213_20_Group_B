---
title: UI primitives and exports
description: Package ownership criteria, source exports, component composition, CSS side effects, and consumer verification.
---

# UI primitives and exports

The package owns reusable interaction building blocks: buttons, inputs, fields,
labels, cards, badges, dialogs, popovers, sheets, selects, tabs, toggles,
commands, tables, feedback states, skeletons, toasts, avatars, separators, and
theme controls.

A component belongs here only when its semantics and API are product-neutral.
Department headers, directory cards, project detail layouts, Portal editors,
and Docs navigation remain in their owning applications even when they compose
several shared primitives.

## Export model

The package exports source modules by subpath:

- `@scs/ui/components/*` for React primitives;
- `@scs/ui/hooks/*` for reusable hooks;
- `@scs/ui/lib/*` for helpers such as `cn`;
- `@scs/ui/styles/theme.css` for semantic tokens and global interaction rules.

Internal source uses `#components`, `#hooks`, and `#lib` aliases. Consumers use
the public package subpaths and should not reach into `src`. CSS is declared as
a package side effect so bundlers retain the explicitly imported theme file;
TypeScript and TSX modules otherwise remain tree-shakeable source exports.

`registry.css` exists as the Tailwind/shadcn generation and lint entry point. It
is not the runtime theme export. Each application imports Tailwind in its own
global stylesheet, scans the shared source, and imports `theme.css` explicitly.

## Change workflow

Prefer composition and variants over app-specific boolean props. Preserve
forwarded attributes, refs where the primitive exposes them, semantic element
roles, disabled behavior, keyboard operation, and focus visibility. A visual
change to a primitive can affect every app even when the package test renders
successfully, so verify representative consumers in addition to package lint,
typecheck, and tests.
