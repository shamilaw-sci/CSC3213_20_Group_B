---
title: Department Web internals
description: Runtime map of departmental MDX content, navigation, metadata, redirects, personal-site resolution, and discovery routes.
---

# Department Web internals

`apps/web` is the public departmental website. Its content is editorial and
institutional; public people records, project discovery, authenticated editing,
and repository documentation remain in their owning applications.

```mermaid
flowchart LR
  Visitor[Visitor] --> Web[Department Web]
  Web --> MDX[Local MDX content]
  Web -->|document navigation| People[People]
  Web -->|document navigation| Projects[Projects]
  Web -->|document navigation| LMS[E-learning]
  Web -->|authenticated /~username lookup| API[API Worker]
  API --> D1[(Redirect settings)]
  Web -->|307 redirect| Personal[Approved personal site]
```

The application has no privileged content database. Its browser-visible origins
and server-only routing integration are parsed in separate typed configuration
modules. See [Content and navigation](CONTENT_AND_NAVIGATION.md) for the local
site and [Routing and redirects](ROUTING_AND_PROXYING.md) for cross-origin and
personal-site behavior.
