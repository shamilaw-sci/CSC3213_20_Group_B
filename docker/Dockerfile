# -----------------------------------------------------------------------------
# Unified Bun Monorepo Development Container
#
# Supports:
# - Next.js Apps
# - Hono APIs
# - Cloudflare Workers
# - Turborepo Monorepos
#
# Single optimized development image.
# -----------------------------------------------------------------------------

FROM oven/bun:1.3.1

# -----------------------------------------------------------------------------
# Workspace
# -----------------------------------------------------------------------------

WORKDIR /app

# -----------------------------------------------------------------------------
# Environment
# -----------------------------------------------------------------------------

ENV NODE_ENV=development
ENV DOCKER=true
ENV HOSTNAME=0.0.0.0

# Better file watching inside Docker
ENV WATCHPACK_POLLING=true
ENV CHOKIDAR_USEPOLLING=true

# -----------------------------------------------------------------------------
# Dependency Installation
# -----------------------------------------------------------------------------

# Copy dependency manifests first for Docker layer caching
COPY package.json bun.lock turbo.json tsconfig.json ./

# Copy workspace packages
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
COPY config-overrides ./config-overrides

# Install all monorepo dependencies
RUN bun install --frozen-lockfile

# -----------------------------------------------------------------------------
# Source Code
# -----------------------------------------------------------------------------

# Copy remaining source files
COPY . .

# Inject per-app environment/config overrides
RUN bun run inject:config

# -----------------------------------------------------------------------------
# Development Ports
# -----------------------------------------------------------------------------

# Next.js Apps
EXPOSE 3000
EXPOSE 3001
EXPOSE 3002
EXPOSE 3003
EXPOSE 3004

# Cloudflare Workers
EXPOSE 8787
EXPOSE 8788

# Hono / APIs
EXPOSE 8789

# -----------------------------------------------------------------------------
# Start Monorepo Development Environment
# -----------------------------------------------------------------------------

CMD ["bun", "run", "dev"]