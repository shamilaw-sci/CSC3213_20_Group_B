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

## Escalation evidence

Include the workspace, exact command or URL, commit SHA, environment category
without secret values, complete error, and whether the failure is local or
provider-side. For deployments, include the deployment ID and confirm which
commit was built. See [Operations](OPERATIONS.md) and [CI](CI.md).
