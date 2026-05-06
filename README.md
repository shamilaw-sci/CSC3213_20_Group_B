# SCS PDN Monorepo

## CSC3213_20_Group_B

A monorepo containing all applications for the SCS PDN platform.

| App                 | Description                | Default Port |
| ------------------- | -------------------------- | ------------ |
| `apps/main-site`    | Main public-facing website | `3001`       |
| `apps/portal`       | Student/staff portal       | `3002`       |
| `apps/people`       | People directory app       | `3003`       |
| `apps/projects`     | Projects showcase app      | `3004`       |
| `apps/api`          | Backend REST API           | `3000`       |
| `apps/auth-worker`  | Cloudflare auth worker     | `8787`       |
| `apps/proxy-worker` | Cloudflare proxy worker    | `8788`       |
| `apps/github-app`   | GitHub app for portal      | `8789`       |

To see the projects in live, please see the bellow table for the links to the deployed applications:

| App                 | Description                | URL                                                                                                |
| ------------------- | -------------------------- | -------------------------------------------------------------------------------------------------- |
| `apps/main-site`    | Main public-facing website | [https://scs-pdn.space](https://scs-pdn.space)                                                     |
| `apps/portal`       | Student/staff portal       | [https://portal.scs-pdn.space](https://portal.scs-pdn.space)                                       |
| `apps/people`       | People directory app       | [https://people.scs-pdn.space](https://people.scs-pdn.space)                                       |
| `apps/projects`     | Projects showcase app      | [https://projects.scs-pdn.space](https://projects.scs-pdn.space)                                   |
| `apps/api`          | Backend REST API           | [https://api.scs-pdn.space](https://api.scs-pdn.space)                                             |
| `apps/auth-worker`  | Cloudflare auth worker     | [https://scs-portal-auth-app.scs-pdn.workers.dev](https://scs-portal-auth-app.scs-pdn.workers.dev) |
| `apps/proxy-worker` | Cloudflare proxy worker    | [https://scs-proxy-worker.scs-pdn.workers.dev](https://scs-proxy-worker.scs-pdn.workers.dev)       |
| `apps/github-app`   | GitHub app for portal      | [https://scs-portal-github-app.vercel.app](https://scs-portal-github-app.vercel.app)               |

---

## Prerequisites

| Tool                          | Version | Install                                                                               |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------- |
| [Bun](https://bun.sh)         | ≥ 1.3.1 | `powershell -c "irm bun.sh/install.ps1 \| iex"`                                       |
| [Node.js](https://nodejs.org) | ≥ 18    | Via [nvm](https://github.com/nvm-sh/nvm) or official installer                        |
| Git                           | any     | `winget install --id Git.Git -e --source winget` / [git-scm.com](https://git-scm.com) |

---

## Getting Started

### 1. Fork & Clone

Each app lives in its own git repository and is registered as a submodule.
You **must** initialise the submodules after cloning or they will be empty.

Before cloning, set up a git config to use the below URL rewrite rule so that you can push to the submodule repos with the correct authentication token:

```bash
git config url."https://<TOKEN>@github.com/".insteadOf "https://github.com/"
```

After setting up the URL rewrite, clone the monorepo with:

```bash
git clone https://github.com/shamilaw-sci/CSC3213_20_Group_B.git --recurse-submodules
cd CSC3213_20_Group_B
```

If you already cloned without `--recurse-submodules`, run:

```bash
git submodule update --init --recursive
```

After cloning, please unset the URL rewrite rule to avoid affecting other repositories:

```bash
git config --unset url."https://<TOKEN>@github.com/".insteadOf
```

---

### 2. Install Dependencies

Install all workspace dependencies from the repo root:

```bash
bun install
```

---

### 3. Inject Configuration Files

The `config-overrides/` directory holds environment files (`.env`, `.env.local`) and
configuration files for each app. Run the injection script to copy them into the
correct locations inside each `apps/*` directory:

```bash
bun run inject:config
```

> **Note:** This step is also run automatically before every `bun run build`.
> Re-run it any time you update files inside `config-overrides/`.

---

### 4. Run the Applications

#### Run all apps at once

```bash
bun run dev
```

This starts all six services in parallel with colour-coded log output:

| Colour         | App            | URL                                            |
| -------------- | -------------- | ---------------------------------------------- |
| Blue           | `main-site`    | [http://localhost:3001](http://localhost:3001) |
| Green          | `portal`       | [http://localhost:3002](http://localhost:3002) |
| Magenta        | `people`       | [http://localhost:3003](http://localhost:3003) |
| Cyan           | `projects`     | [http://localhost:3004](http://localhost:3004) |
| Bright Blue    | `api`          | [http://localhost:3000](http://localhost:3000) |
| Bright Green   | `auth-worker`  | [http://localhost:8787](http://localhost:8787) |
| Bright Magenta | `proxy-worker` | [http://localhost:8788](http://localhost:8788) |
| Bright Cyan    | `github-app`   | [http://localhost:8789](http://localhost:8789) |

#### Run a single app

```bash
bun run dev:main            # main-site    → http://localhost:3001
bun run dev:portal          # portal       → http://localhost:3002
bun run dev:people          # people       → http://localhost:3003
bun run dev:projects        # projects     → http://localhost:3004
bun run dev:api             # api          → http://localhost:3000
bun run dev:worker:auth     # auth-worker  → http://localhost:8787
bun run dev:worker:proxy    # proxy-worker → http://localhost:8788
bun run dev:github:App      # github-app   → http://localhost:8789
```

---

### 5. Build for Production

```bash
bun run build
```

Turbo runs builds for all apps in dependency order and caches the results.

---

## Useful Scripts

| Command                                  | Description                            |
| ---------------------------------------- | -------------------------------------- |
| `bun run dev`                            | Start all apps in development mode     |
| `bun run build`                          | Build all apps for production          |
| `bun run inject:config`                  | Copy config overrides into each app    |
| `bun run format`                         | Format all source files with Prettier  |
| `git submodule update --remote --merge`  | Pull latest changes for all submodules |
| `git tag -a vx.y.z -m "Release Message"` | Create a new annotated git tag         |
| `git push origin vx.y.z`                 | Push the new tag to GitHub             |

---

## Project Structure

```text
CSC3213_20_Group_B/
├── apps/                  # Git submodules — one repo per app
│   ├── api/
│   ├── auth-worker/
|   ├── github-app/
│   ├── main-site/
│   ├── people/
│   ├── portal/
│   ├── projects/
|   └── proxy-worker/
├── config-overrides/      # Env & config files injected into each app
│   ├── api/
│   ├── auth-worker/
|   ├── github-app/
│   ├── main-site/
│   ├── people/
│   ├── portal/
│   ├── projects/
|   └── proxy-worker/
├── scripts/
│   └── inject-config.ts   # Config injection script
├── package.json
├── turbo.json
└── bun.lock
```

---

## Troubleshooting

| Problem                                           | Solution                                                     |
| ------------------------------------------------- | ------------------------------------------------------------ |
| `apps/*` directories are empty                    | Run `git submodule update --init --recursive`                |
| Missing `.env` / `.env.local` files inside an app | Run `bun run inject:config`                                  |
| Port already in use                               | Stop the conflicting process                                 |
| `bun: command not found`                          | Install Bun: `powershell -c "irm bun.sh/install.ps1 \| iex"` |
