# Tooling Consolidation Notes

The root agent-skill set contains the byte-identical skill tree previously
repeated by the Web, People, and Projects workspaces, plus the API's unique
Cloudflare, Workers, and Wrangler skills. Their package-level copies were
removed only after content comparisons passed.

The Portal skill bundle remains under `apps/portal/.agents` with its original
lock file. Its `next-best-practices` and `shadcn` directories have the same
names as root skills but different committed content, so neither variant was
silently overwritten. The Portal bundle also remains cohesive for its unique
skills and source-specific lock metadata. Its `nextjs` directory happens to be
byte-identical to the root copy, but is retained because selectively rewriting
the Portal lock would make that source snapshot harder to audit.

The People skill lock named a different upstream source even though its
committed `.agents` tree was byte-identical to Web and Projects. The root lock
uses the Web/Projects metadata, while this note preserves that provenance
difference for later review.
