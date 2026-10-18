# Tooling Consolidation Notes

Agent skill payloads are local generated tooling rather than repository
source. Every `.agents` directory is ignored and absent from Git. The root
`skills-lock.json` records the common Web, People, Projects, and API skill set,
and `bunx skills experimental_install` restores that set locally when needed.

The Portal lock remains under `apps/portal/skills-lock.json`. Its
`next-best-practices` and `shadcn` entries have the same names as root skills
but different committed content, so neither variant was silently overwritten.
Running the same install command from `apps/portal` restores that scoped set
to the ignored `apps/portal/.agents` directory.

The current installer could no longer resolve six legacy root entries or the
Portal `nextjs` entry from their recorded upstream paths. Those unusable lock
entries were removed after a failed restore demonstrated the drift. The
remaining root and Portal locks both restore completely; historical source
provenance remains available in the migration commits that preceded this
local-tooling policy change.

The People skill lock named a different upstream source even though its
committed `.agents` tree was byte-identical to Web and Projects. The root lock
uses the Web/Projects metadata, while this note preserves that provenance
difference for later review.
