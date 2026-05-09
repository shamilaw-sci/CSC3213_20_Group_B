# SCS PDN Monorepo

## CSC3213_20_Group_B

A monorepo containing all applications for the SCS PDN platform.

| App                 | Description                | Default Port |
| ------------------- | -------------------------- | ------------ |
| `apps/main-site`    | Main public-facing website | `auto`       |
| `apps/portal`       | Student/staff portal       | `auto`       |
| `apps/people`       | People directory app       | `auto`       |
| `apps/projects`     | Projects showcase app      | `auto`       |
| `apps/api`          | Backend REST API           | `auto`       |
| `apps/github-app`   | GitHub app for portal      | `auto`       |
| `apps/auth-worker`  | Cloudflare auth worker     | `8787`       |
| `apps/proxy-worker` | Cloudflare proxy worker    | `8788`       |

To see the projects in live, please see the bellow table for the links to the deployed applications:

| App                 | Description                | URL                                                                                                |
| ------------------- | -------------------------- | -------------------------------------------------------------------------------------------------- |
| `apps/main-site`    | Main public-facing website | [https://scs-pdn.space](https://scs-pdn.space)                                                     |
| `apps/portal`       | Student/staff portal       | [https://portal.scs-pdn.space](https://portal.scs-pdn.space)                                       |
| `apps/people`       | People directory app       | [https://people.scs-pdn.space](https://people.scs-pdn.space)                                       |
| `apps/projects`     | Projects showcase app      | [https://projects.scs-pdn.space](https://projects.scs-pdn.space)                                   |
| `apps/api`          | Backend REST API           | [https://api.scs-pdn.space](https://api.scs-pdn.space)                                             |
| `apps/github-app`   | GitHub app for portal      | [https://scs-portal-github-app.vercel.app](https://scs-portal-github-app.vercel.app)               |
| `apps/auth-worker`  | Cloudflare auth worker     | [https://scs-portal-auth-app.scs-pdn.workers.dev](https://scs-portal-auth-app.scs-pdn.workers.dev) |
| `apps/proxy-worker` | Cloudflare proxy worker    | [https://scs-proxy-worker.scs-pdn.workers.dev](https://scs-proxy-worker.scs-pdn.workers.dev)       |

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

This starts all six services in parallel. The frontend apps will be available at the URLs listed below, and the workers will be running on their respective ports.

| App            | URL                                                              |
| -------------- | ---------------------------------------------------------------- |
| `main-site`    | [https://scs.localhost](https://scs.localhost)                   |
| `portal`       | [https://portal.scs.localhost](https://portal.scs.localhost)     |
| `people`       | [https://people.scs.localhost](https://people.scs.localhost)     |
| `projects`     | [https://projects.scs.localhost](https://projects.scs.localhost) |
| `api`          | [https://api.scs.localhost](https://api.scs.localhost)           |
| `github-app`   | [https://github.scs.localhost](https://github.scs.localhost)     |
| `auth-worker`  | [http://127.0.0.1:8787](http://127.0.0.1:8787)                   |
| `proxy-worker` | [http://127.0.0.1:8788](http://127.0.0.1:8788)                   |

---

### 5. Build for Production

```bash
bun run build
```

### 6. Run the production build

```bash
bun run start
```

Turbo runs builds for all apps in dependency order and caches the results.

---

### 6. Docker Setup

> **Note:** Docker setup is currently a work in progress. The previous Docker configuration files have been removed and will be re-added in a future commit.

---

## Useful Scripts

| Command                                  | Description                            |
| ---------------------------------------- | -------------------------------------- |
| `bun run dev`                            | Start all apps in development mode     |
| `bun run build`                          | Build all apps for production          |
| `bun run start`                          | Start all apps in production mode      |
| `bun run inject:config`                  | Copy config overrides into each app    |
| `bun run format`                         | Format source files with Prettier      |
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
