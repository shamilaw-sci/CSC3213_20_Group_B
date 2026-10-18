# Tooling Consolidation Notes

Agent skill payloads are local generated tooling rather than repository
source. Every `.agents` directory is ignored and absent from Git. The root
`skills-lock.json` records the reconciled skill set for the entire monorepo,
and `bunx skills experimental_install` restores that set locally from the
repository root when needed.

The current installer could no longer resolve six legacy root entries or the
Portal `nextjs` entry from their recorded upstream paths. Those unusable lock
entries were removed after failed restores demonstrated the drift. The twelve
remaining entries are consolidated in the root lock; historical source
provenance remains available in the migration commits that preceded this
local-tooling policy change.

Running the installer from `apps/portal` removed tracked workspace files while
reconciling the nested lock. Those files were restored from the current
monorepo commit, and nested installation is no longer part of the workflow.

The People skill lock named a different upstream source even though its
committed `.agents` tree was byte-identical to Web and Projects. The root lock
uses the Web/Projects metadata, while this note preserves that provenance
difference for later review.
