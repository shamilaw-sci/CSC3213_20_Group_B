---
title: Glossary
description: Shared terminology for records, roles, services, deployment state, and repository workflows.
---

# Glossary

| Term               | Meaning                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------- |
| API                | The browser-facing Cloudflare Worker in `services/api`                                       |
| canonical record   | The current supported public-data shape validated by `@scs/schemas`                          |
| data repository    | The separate Git repository containing publishable people, project, and academic records     |
| deployment adapter | Hosting integration behavior, such as Vercel or OpenNext, outside application business logic |
| operation          | A durable asynchronous Git-backed mutation with queryable status                             |
| Portal             | The authenticated management application in `apps/portal`                                    |
| proxy              | A controlled API identity/permission mechanism, not a browser network proxy                  |
| public app         | Web, People, or Projects; reads published data without privileged automation credentials     |
| revision           | The version token used to protect an update from overwriting a newer record                  |
| schema package     | `@scs/schemas`, the direct shared source of runtime and transport contracts                  |
| workspace gate     | The declared lint, typecheck, test, and build scripts relevant to one workspace              |

Use domain-specific labels in user interfaces. A project participant may have
multiple explicit roles; do not collapse them into a misleading generic label.
For academic records, distinguish program, department/stream, track, level,
status, and placement according to the schema rather than inferring one from
another.
