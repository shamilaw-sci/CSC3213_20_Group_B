# SCS PDN Monorepo

A monorepo containing all applications for the SCS PDN platform.

| App | Description | Default Port |
|-----|-------------|-------------|
| `apps/main-site` | Main public-facing website | `3001` |
| `apps/portal` | Student/staff portal | `3002` |
| `apps/people` | People directory app | `3003` |
| `apps/projects` | Projects showcase app | `3004` |
| `apps/api` | Backend REST API | `3000` |
| `apps/auth-worker` | Cloudflare auth worker | `8787` |

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| [Bun](https://bun.sh) | ≥ 1.3.1 | `curl -fsSL https://bun.sh/install | bash` |
| [Node.js](https://nodejs.org) | ≥ 18 | Via [nvm](https://github.com/nvm-sh/nvm) or official installer |
| Git | any | `sudo apt install git` / [git-scm.com](https://git-scm.com) |

---

## Getting Started

### 1. Fork & Clone (with submodules)

Each app lives in its own git repository and is registered as a submodule.
You **must** initialise the submodules after cloning or they will be empty.

```bash
# Clone your fork (replace <your-username> with your GitHub username)
git clone --recurse-submodules https://github.com/<your-username>/scs-pdn-monorepo.git
cd scs-pdn-monorepo
```

If you already cloned without `--recurse-submodules`, run:

```bash
git submodule update --init --recursive
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

#### Run all apps at once (recommended for full-stack development)

```bash
bun run dev
```

This starts all six services in parallel with colour-coded log output:

| Colour | App |
|--------|-----|
| Blue | `main-site` → http://localhost:3001 |
| Green | `portal` → http://localhost:3002 |
| Yellow | `people` → http://localhost:3003 |
| Magenta | `projects` → http://localhost:3004 |
| Cyan | `api` → http://localhost:3000 |
| White | `auth-worker` → http://localhost:8787 |

#### Run a single app

```bash
bun run dev:main      # main-site   → http://localhost:3001
bun run dev:portal    # portal      → http://localhost:3002
bun run dev:people    # people      → http://localhost:3003
bun run dev:projects  # projects    → http://localhost:3004
bun run dev:api       # api         → http://localhost:3000
bun run dev:worker    # auth-worker → http://localhost:8787
```

---

### 5. Build for Production

```bash
bun run build
```

Turbo runs builds for all apps in dependency order and caches the results.

---

## Useful Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start all apps in development mode |
| `bun run build` | Build all apps for production |
| `bun run inject:config` | Copy config overrides into each app |
| `bun run format` | Format all source files with Prettier |

---

## Project Structure

```
scs-pdn-monorepo/
├── apps/                  # Git submodules — one repo per app
│   ├── main-site/
│   ├── portal/
│   ├── people/
│   ├── projects/
│   ├── api/
│   └── auth-worker/
├── config-overrides/      # Env & config files injected into each app
│   ├── api/
│   ├── auth-worker/
│   ├── main-site/
│   ├── people/
│   ├── portal/
│   └── projects/
├── scripts/
│   └── inject-config.ts   # Config injection script
├── package.json
├── turbo.json
└── bun.lock
```

---

## Updating Submodules

To pull the latest commits for all submodules:

```bash
git submodule update --remote --merge
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `apps/*` directories are empty | Run `git submodule update --init --recursive` |
| Missing `.env` / `.env.local` files inside an app | Run `bun run inject:config` |
| Port already in use | Stop the conflicting process or edit the port in `package.json` |
| `bun: command not found` | Install Bun: `curl -fsSL https://bun.sh/install | bash` |
