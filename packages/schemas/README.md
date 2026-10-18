# Academic Domain Schemas

Shared data definitions for Faculty of Science academic systems.

This package keeps the main academic data shapes in one place so faculty
portals, APIs, public sites, automation services, and data validators all agree
on the same structure.

## What It Is For

- People, student, and staff profiles.
- Faculty, department, academic unit, subject, and honours programme catalogues.
- Courses and course offerings.
- Project registry records.
- Reusable academic objects such as publications and social links.

## Using It

Add the local workspace dependency and import schemas from the package root:

```json
"@scs/schemas": "workspace:*"
```

```ts
import {
  ProgramSchema,
  ScienceAcademicDepartments,
  StudentSchema,
} from '@scs/schemas';
```

The Faculty of Science catalogue includes hardcoded department ownership for
honours programmes and subject teaching departments. For example, Computer
Science, Data Science, Statistics, and Statistics and Operations Research are
attached to the Department of Statistics and Computer Science, while Biology
subjects are attached to Botany, Molecular Biology and Biotechnology, and
Zoology.

## Development

```powershell
bun --filter '@scs/schemas' lint
bun --filter '@scs/schemas' typecheck
bun --filter '@scs/schemas' typecheck:test
bun --filter '@scs/schemas' test
bun --filter '@scs/schemas' build
```

Common maintenance scripts:

- `bun run typecheck`: type-check package source.
- `bun run typecheck:test`: type-check tests.
- `bun run lint`: run ESLint.
- `bun run build`: build the package output.

This workspace was imported from the clean
`academic-domain-schemas@v5.1.0` committed tree. Its historical changelog and
release guide are retained for provenance, but this private monorepo workspace
is not published independently.

## Documentation

Schema maps, Mermaid diagrams, and domain notes live in [`docs`](./docs/README.md).

Use this repo when a shared academic JSON shape needs to change.
