---
title: UI package internals
description: Maintainer guide to shared shadcn primitives, source exports, semantic theme tokens, theme initialization, and accessibility contracts.
---

# UI package internals

`packages/ui` supplies product-neutral shadcn-style primitives and the semantic
visual foundation used across applications. It deliberately does not supply a
unified product shell.

```mermaid
flowchart LR
  Tokens[Semantic theme CSS] --> App[Owning application]
  Primitive[Shared primitive] --> App
  App --> Composition[Product shell and domain components]
```

Read [Primitives and exports](PRIMITIVES_AND_EXPORTS.md) before adding or
changing a component and [Theme and accessibility](THEME_AND_ACCESSIBILITY.md)
before changing tokens, color modes, focus, or motion behavior.
