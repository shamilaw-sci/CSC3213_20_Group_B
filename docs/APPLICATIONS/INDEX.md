---
title: Application internals
description: Code-derived guides to the repository's interactive applications and their runtime boundaries.
---

# Application internals

These guides explain how each application turns routes, shared contracts, and
downstream services into user-facing behavior. They supplement the concise
workspace overviews rather than replacing them.

| Application                   | Primary audience               | Runtime boundary                                       |
| ----------------------------- | ------------------------------ | ------------------------------------------------------ |
| [Web](WEB/INDEX.md)           | department visitors            | editorial MDX, redirects, and personal-site resolution |
| [People](PEOPLE/INDEX.md)     | directory visitors             | published people and project JSON                      |
| [Projects](PROJECTS/INDEX.md) | project visitors               | published project JSON and path-based discovery        |
| [Portal](PORTAL/INDEX.md)     | members and administrators     | authenticated browser and server calls to the API      |
| [Docs](DOCS/INDEX.md)         | maintainers, operators, agents | statically derived handbook pages and discovery feeds  |
