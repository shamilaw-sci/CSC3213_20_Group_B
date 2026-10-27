---
title: UI system
description: Shared primitives, app-owned composition, theme tokens, responsive navigation, accessibility, and interface conventions.
---

# UI system

The applications use Tailwind CSS and shadcn-style primitives from `@scs/ui`.
The shared package owns reusable primitives and hooks; each app owns its shell,
navigation, content composition, and domain-specific components.

## Design rules

- Use semantic theme tokens such as background, foreground, muted, accent,
  primary, destructive, border, and ring. Do not embed literal color values in
  TSX class strings.
- Use the shared button, input, dialog, feedback, theme, and navigation
  primitives before creating an app-local primitive.
- Keep current-location states visually aligned, keyboard reachable, and
  announced with `aria-current` or the corresponding control semantics.
- Keep mobile navigation task-oriented and avoid duplicating actions already
  present in the page body.
- Use route-specific loading skeletons that resemble the eventual page, plus
  local, global, 404, and global-not-found fallbacks.

The public apps share typography and semantic colors without forcing identical
information architecture. People prioritizes identity and directory browsing;
Projects prioritizes showcase discovery; Portal prioritizes editing workflows;
Web prioritizes departmental content.

The Docs application keeps the Fumadocs shell but maps its `fd` color tokens to
the shared semantic palette, uses the repository's Open Sans and Source Serif
font configuration, and publishes the same SCS favicon artwork as the public
applications. Its manifest keeps a Docs-specific name so installed shortcuts
remain distinguishable.

## Review

Run lint to enforce Tailwind canonical classes and class ordering. Test light
and dark themes, hover/focus/pressed states, narrow layouts, reduced motion,
keyboard navigation, and readable contrast. The detailed review checklist is in
[UI quality assurance](UI_QUALITY_ASSURANCE.md); shared package boundaries are in
[UI package](PACKAGE_UI.md).
