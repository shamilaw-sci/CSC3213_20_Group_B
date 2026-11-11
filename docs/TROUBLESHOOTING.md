---
title: Troubleshooting
description: A symptom-first guide to local setup, builds, routes, data, authentication, Cloudflare, and deployment failures.
---

# Troubleshooting

Start by reproducing the smallest failing command in the owning workspace. Read
the first causal error, check the workspace's typed configuration, and compare
against a working sibling before changing code.

## Common symptoms

| Symptom                                                   | First checks                                                                                 |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Workspace is not found                                    | Run `bun install`, verify its `package.json` name, and run from the repository root          |
| Vercel reports `Cannot find module 'next/setup-node-env'` | Keep `linker = "hoisted"` in `bunfig.toml`, reinstall, and rebuild the affected app          |
| Next build misses `.next` files on Vercel                 | Confirm Turbo build outputs and do not replay stale/incomplete remote cache artifacts        |
| A route works by full reload but not client navigation    | External cross-origin destinations must use a normal anchor; internal routes use `next/link` |
| Public profile or project data is missing                 | Check the configured public-data base URL, HTTP status, and schema parse error               |
| Portal signs in but an action is forbidden                | Inspect API permission state; UI visibility is not the authorization source                  |
| Mutation remains pending                                  | Query the operation endpoint, then inspect queue, Durable Object, and GitHub provider logs   |
| Mail request is rejected                                  | Check bearer authentication and the shared mail request schema before SMTP                   |
| Dark theme text is unreadable                             | Replace literal colors with semantic tokens and verify hover/focus states                    |

### Vercel cannot resolve `next/setup-node-env`

Next 16.4's deployment adapter registers `next/setup-node-env` as a virtual
asset at the resolved `next` package path. Vercel's Next.js packager resolves
the adapter launcher from the application's `node_modules` tree and does not
follow Bun's isolated `.bun` store links, so the virtual asset is unreachable at
runtime. Root `bunfig.toml` pins `linker = "hoisted"` so the package stays at
`node_modules/next`, which is on the launcher's resolution path.

After changing the linker, delete `node_modules` and run
`bun install --frozen-lockfile`. Reusing a tree built by the other linker leaves
a mixed layout.

## Escalation evidence

Include the workspace, exact command or URL, commit SHA, environment category
without secret values, complete error, and whether the failure is local or
provider-side. For deployments, include the deployment ID and confirm which
commit was built. See [Operations](OPERATIONS.md) and [CI](CI.md).
