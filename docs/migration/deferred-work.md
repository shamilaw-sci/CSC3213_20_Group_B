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

`packages/ui`, `packages/schemas`, and `packages/utils` remain empty. No shared
component, schema, or utility was extracted before every imported workspace
passed independently. Any future extraction should begin with proven duplicate
behavior and retain each consumer's public interface.

The published `@csc3213-2026-group-b/academic-domain-schemas` dependency also
remains external at version `5.1.0`; replacing it with a local package is a
separate compatibility decision.

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
- Review the intentionally empty shared-package directories only after the
  baseline has production evidence.
