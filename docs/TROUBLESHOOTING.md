---
title: Troubleshooting
description: A symptom-first guide to local setup, builds, routes, data, authentication, Cloudflare, and deployment failures.
---

# Troubleshooting

Start by reproducing the smallest failing command in the owning workspace. Read
the first causal error, check the workspace's typed configuration, and compare
against a working sibling before changing code.

## Common symptoms

| Symptom                                                | First checks                                                                                 |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Workspace is not found                                 | Run `bun install`, verify its `package.json` name, and run from the repository root          |
| Next build misses `.next` files on Vercel              | Confirm Turbo build outputs and do not replay stale/incomplete remote cache artifacts        |
| A route works by full reload but not client navigation | External cross-origin destinations must use a normal anchor; internal routes use `next/link` |
| Public profile or project data is missing              | Check the configured public-data base URL, HTTP status, and schema parse error               |
| Portal signs in but an action is forbidden             | Inspect API permission state; UI visibility is not the authorization source                  |
| Mutation remains pending                               | Query the operation endpoint, then inspect queue, Durable Object, and GitHub provider logs   |
| Mail request is rejected                               | Check bearer authentication and the shared mail request schema before SMTP                   |
| Dark theme text is unreadable                          | Replace literal colors with semantic tokens and verify hover/focus states                    |

## Vercel Next.js function cannot find `next/setup-node-env`

This error can occur when Turborepo restores a cached Next.js build, skipping the Vercel adapter's `onBuildComplete` callback that registers the virtual `next/setup-node-env` asset. As a result, the deployed function may fail at runtime.

**Fix:** Disable Turbo caching for the `build` task in affected Next.js applications using their package-level `turbo.json`, while preserving other caching behavior.

**Verification:** Confirm `cache bypass` in Vercel build logs and test a dynamic route to ensure the deployed function starts successfully.

## Escalation evidence

Include the workspace, exact command or URL, commit SHA, environment category
without secret values, complete error, and whether the failure is local or
provider-side. For deployments, include the deployment ID and confirm which
commit was built. See [Operations](OPERATIONS.md) and [CI](CI.md).
