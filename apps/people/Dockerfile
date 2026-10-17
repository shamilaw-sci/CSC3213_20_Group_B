# -----------------------------------------------------------------------------
# This Dockerfile.bun is specifically configured for projects using Bun.
# -----------------------------------------------------------------------------

# Use Bun's official image
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies with bun
FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DOCKER=true
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# =============================================================
# people.scs.pdn.ac.lk build environment
# NEXT_PUBLIC_* values are inlined at build time.
# =============================================================

# --- Site ---
ENV NEXT_PUBLIC_SITE_URL=https://people.scs.pdn.ac.lk
ENV NEXT_PUBLIC_PEOPLE_DATA_BASE_URL=https://data.scs.pdn.ac.lk/people/v2
ENV NEXT_PUBLIC_PROJECTS_DATA_BASE_URL=https://data.scs.pdn.ac.lk/projects/v2
ENV NEXT_PUBLIC_PROJECTS_SITE_URL=https://projects.scs.pdn.ac.lk

RUN bun run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

RUN getent group bun || groupadd --system --gid 1001 bun && \
    id -u nextjs 2>/dev/null || useradd --system --uid 1001 --no-log-init -g bun nextjs

COPY --from=builder /app/public ./public
# Automatically leverage output traces to reduce image size
# Learn more here: https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:bun /app/.next/standalone ./
COPY --from=builder --chown=nextjs:bun /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["bun", "server.js"]
