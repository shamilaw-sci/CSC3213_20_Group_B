FROM oven/bun:1.3.1 AS base

WORKDIR /app

# Install workspace dependencies once for all apps.
COPY package.json bun.lock turbo.json tsconfig.json ./
COPY apps ./apps
COPY config-overrides ./config-overrides
COPY scripts ./scripts

RUN bun install

# Inject per-app env/config files from config-overrides.
RUN bun run inject:config

EXPOSE 3000 3001 3002 3003 3004 8787 8788 8789

CMD ["bun", "run", "dev"]
