# -----------------------------------------------------------------------------
# Bun Multi-Stage Dockerfile for Nest.js Monorepo Apps
# -----------------------------------------------------------------------------

FROM oven/bun:1.3.1 AS base

WORKDIR /workspace

# -----------------------------------------------------------------------------
# Dependencies
# -----------------------------------------------------------------------------

FROM base AS deps

COPY package.json bun.lock* ./
COPY apps ./apps
COPY packages ./packages

RUN bun install --frozen-lockfile

# -----------------------------------------------------------------------------
# Builder
# -----------------------------------------------------------------------------

FROM base AS builder

ARG APP_NAME

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER=true
ENV HOSTNAME=0.0.0.0

COPY --from=deps /workspace/node_modules ./node_modules
COPY . .

WORKDIR /workspace/apps/${APP_NAME}

RUN bun run build

# -----------------------------------------------------------------------------
# Runner
# -----------------------------------------------------------------------------

FROM oven/bun:1.3.1 AS runner

WORKDIR /app

ARG APP_NAME

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Optional non-root user
RUN groupadd --system --gid 1001 bunjs && \
    useradd --system --uid 1001 --gid bunjs appuser

# Copy standalone build
COPY --from=builder --chown=appuser:bunjs \
    /workspace/apps/${APP_NAME}/.next/standalone ./

COPY --from=builder --chown=appuser:bunjs \
    /workspace/apps/${APP_NAME}/.next/static ./.next/static

COPY --from=builder --chown=appuser:bunjs \
    /workspace/apps/${APP_NAME}/public ./public

USER appuser

EXPOSE 3000

CMD ["bun", "server.js"]