# Migration Matrix

This matrix classifies the audited root-level material in all seven source
repositories. It is applied to committed Git trees only.

| Source material | Classification | Destination and rationale |
| --- | --- | --- |
| `src/**`, `public/**`, app assets | Keep inside app/service | Runtime-owned product files remain with their deployable workspace. |
| Tests and test setup | Keep inside app/service | Preserve existing Vitest and Bun suites without changing runners. |
| Workspace `package.json` | Keep inside app/service | Rename to `@scs/*`; preserve scripts and versions until validation. |
| Source `bun.lock` files | Keep temporarily during import, then remove as duplicate | Dependency intent is reconciled into the single generated root lockfile. |
| `bunfig.toml` | Move to monorepo root | Six repositories share the seven-day release-age gate; mailer differs only by lacking the schema exemption. |
| Frontend `eslint.config.ts` | Keep temporarily, then extract | All four are byte-identical and become `@scs/eslint-config/next` only after baseline lint passes. |
| API/GitHub App ESLint | Keep temporarily, then extract | Worker rules are largely shared; API ignores and GitHub App test overrides stay local. |
| Frontend `tsconfig.json` | Keep temporarily, then extract | Runtime defaults can be shared; aliases, includes, and test exclusions stay local. |
| Worker TypeScript projects | Keep inside service, then share bases | Project references and runtime/test differences remain service-owned. |
| Mailer `tsconfig.json` | Keep inside service, then extend Bun preset | Hono/Bun runtime settings remain distinct from Workers and Next.js. |
| Next.js configuration | Keep inside app | Add only monorepo tracing-root support; preserve standalone and experimental behavior. |
| PostCSS and `components.json` | Keep inside app | These participate in each app's Tailwind/shadcn behavior. |
| Vitest configuration | Keep inside `apps/projects` | Projects is the only frontend with an existing test runner. |
| `knip.json` | Keep inside workspace | Entry points and ignore behavior are workspace-relative. |
| Wrangler configuration | Keep inside service | Preserve separate Worker names, routes, bindings, and deployment commands; remove plaintext secrets. |
| Environment examples | Keep inside workspace | Preserve variable contracts with non-secret examples only. |
| Ignored `.env*` and `.dev.vars` | Never import | Local values are not committed migration inputs. |
| GitHub App `keys/**` and `*.pem` | Never import | Private keys are secret material and require rotation, not migration. |
| Dockerfiles | Keep temporarily, then repair | Each image stays independent but must build from monorepo root context. |
| `.dockerignore` | Merge into root | Docker uses the monorepo root context after repair. |
| Frontend GitHub Actions | Merge into root | Preserve manual GHCR publishing with stable image names and add monorepo checks. |
| API/mailer/GitHub App deployment configs | Keep inside service | No deployment workflow is invented where the source has none. |
| `.husky/**` | Remove as duplicate after root hook | Every source pre-commit hook is identical and delegates to lint-staged. |
| Package-level lint-staged/Prettier blocks | Merge into root | Preserve rules through one root dispatcher and formatter configuration. |
| `.devcontainer/**` | Merge into root | Combine Bun workspace setup and frontend/Worker ports. |
| `.vscode/**` | Merge into root | Preserve the union of useful settings and recommendations. |
| `.agents/**`, `skills-lock.json` | Keep temporarily, then reconcile | Identical skills are deduplicated; unique/conflicting skills are reviewed explicitly. |
| Custom scripts and workspace docs | Keep inside workspace | Paths and instructions are repaired relative to the new workspace root. |
| Root READMEs | Keep inside workspace and summarize at root | Workspace-specific operation stays local; monorepo operation is documented centrally. |
| `.gitattributes`, `.gitignore` | Merge into root | Normalize line endings and cover every generated/cache/secret class. |
| `node_modules`, `.next`, `.cache`, `.turbo`, `.wrangler`, `dist`, `build`, `out`, coverage | Remove as generated | Recreated by install, test, and build commands. |
| `*.tsbuildinfo`, generated `next-env.d.ts` | Remove as generated | Recreated by TypeScript and Next.js. |
| Nested `.git` directories | Never import | The destination retains its own Git history and does not use submodules. |
| `@csc3213-2026-group-b/academic-domain-schemas` | Keep external | Preserve published package lifecycle and version `5.1.0` for the baseline. |
| `packages/ui`, `packages/schemas`, `packages/utils` | Leave empty unless justified | No abstraction is created before verified duplication analysis. |

## Captured Shared Tooling Values

The source packages use `printWidth: 80`, `tabWidth: 2`, spaces, semicolons,
single quotes, ES5 trailing commas, bracket spacing, parenthesized arrow
parameters, and automatic end-of-line handling. API and GitHub App additionally
disable trailing commas for `*.jsonc`.

Frontend lint-staged behavior runs cached ESLint fixes for `*.{ts,tsx}` and
Prettier for `*.{json,md,css,html,ts,tsx}`. API and GitHub App use their Worker
ESLint configuration for `src/**/*.ts`; mailer formats
`*.{js,ts,json,md,yml,yaml}`. The root dispatcher must reproduce these scopes
before package-level blocks are removed from the remaining workspaces.
