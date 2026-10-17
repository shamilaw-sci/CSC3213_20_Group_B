# projects.scs.pdn.ac.lk

Public project registry for SCS PDN.

The site helps visitors browse student projects, research work, department
systems, open-source tools, datasets, and collaborations.

## What It Is For

- Project registry home page.
- Project search.
- Browsing by category, topic, and course.
- Individual project pages.
- Public project discovery.

## Data Source

Project data is published from `data.scs.pdn.ac.lk` and served from:

```text
https://data.scs-pdn.space/projects/v2
```

Project editing happens in the portal, not on this public site.

## Development

```sh
bun install
bun run dev
```

Useful checks:

```sh
bun run test
bun run lint
bun run build
```
