---
title: Application internals
description: Code-derived guides to the repository's interactive applications and their runtime boundaries.
---

# Application internals

These guides explain how each application turns routes, shared contracts, and
downstream services into user-facing behavior. They supplement the concise
workspace overviews rather than replacing them.

| Application               | Primary audience               | Runtime boundary                                      |
| ------------------------- | ------------------------------ | ----------------------------------------------------- |
| [Portal](PORTAL/INDEX.md) | members and administrators     | authenticated browser and server calls to the API     |
| [Docs](DOCS/INDEX.md)     | maintainers, operators, agents | statically derived handbook pages and discovery feeds |

The public [Web](../APPLICATION_WEB.md),
[People](../APPLICATION_PEOPLE.md), and
[Projects](../APPLICATION_PROJECTS.md) applications have workspace overviews.
Their detailed code-derived guides belong here as the next application
documentation phases.
