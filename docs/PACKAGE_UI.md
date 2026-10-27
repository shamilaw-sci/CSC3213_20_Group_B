---
title: UI package
description: Shared shadcn primitives, hooks, semantic theme tokens, exports, ownership, and verification for packages/ui.
---

# UI package

`packages/ui` (`@scs/ui`) contains reusable shadcn-style primitives, hooks,
utilities, and theme CSS. Its wildcard exports expose components, hooks, and
library helpers, plus `styles/theme.css`.

Put a component here when it is a reusable primitive with product-neutral
behavior: buttons, inputs, dialogs, feedback states, theme controls, or similar
building blocks. Keep navigation shells, profile cards, project showcases,
editor workflows, and other domain composition inside the owning application.

Components use semantic CSS variables rather than embedded palette values.
They must support keyboard interaction, visible focus, light and dark themes,
disabled states, and composability without assuming one app's layout. Do not
copy a primitive into an app to make a small variation; extend its supported
API when that behavior is genuinely shared.

Run package lint, typecheck, and tests. Then run affected application tests and
builds because source exports are compiled by each consumer. Follow
[UI system](UI_SYSTEM.md) and
[UI quality assurance](UI_QUALITY_ASSURANCE.md).

The [UI package internals](PACKAGES/UI/INDEX.md) guide explains
[primitive ownership and exports](PACKAGES/UI/PRIMITIVES_AND_EXPORTS.md) and the
[theme and accessibility contract](PACKAGES/UI/THEME_AND_ACCESSIBILITY.md).
