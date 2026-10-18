# Deferred Work

The migration baseline prioritizes source fidelity and independently
deployable workspaces. The following work is intentionally deferred.

## Excluded dirty working trees

The uncommitted changes in these source repositories were not migration inputs:

- `C:\Users\sivot\Documents\CSC3213\portal.scs.pdn.ac.lk`
- `C:\Users\sivot\Documents\CSC3213\people.scs.pdn.ac.lk`

Review and migrate those changes separately after the baseline is stable. The
source repositories must remain untouched during that review. The path-only
inventory in `source-state.md` identifies the excluded files without embedding
their contents.

## Shared product packages

`packages/ui`, `packages/schemas`, and `packages/utils` remained empty through
the independently validated baseline. The clean published schema source at tag
`v5.1.0` was then migrated into `packages/schemas` as private workspace
`@scs/schemas`; its sibling source repository remains untouched. The UI audit
first extracted byte-identical primitives, then established one canonical
implementation for all 19 migrated shadcn primitives in `@scs/ui`. App-specific
visual behavior is represented by explicit variants, while composed product
components remain app-owned. `packages/utils` remains unjustified and absent.

## Missing coverage and external checks

- Web, People, Portal, and Mailer have no automated test suite in the migrated
  baseline.
- Portal authenticated mutations were not exercised.
- API OAuth, KV-backed behavior, outbound mail, GitHub App authentication, and
  provider deployments require external credentials or services and were not
  exercised by the local baseline gate.
- No Docker build or container runtime check was run because container support
  was explicitly removed from scope.

## Deployment follow-up

- Rotate every secret or private key that appeared in a source repository and
  configure the destination provider stores.
- Choose and document native deployment automation for the frontend apps,
  Mailer, and GitHub App if automation is required. The baseline CI verifies
  code only and does not publish artifacts.
- Review `packages/utils` and any remaining UI duplication only after the
  baseline has production evidence.
