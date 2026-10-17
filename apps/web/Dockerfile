# -----------------------------------------------------------------------------
# This Dockerfile is specifically configured for projects using Bun
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
ENV HOSTNAME="0.0.0.0"
ENV NEXT_PUBLIC_SITE_URL=https://scs-pdn.space
ENV BASE_DOMAIN=scs-pdn.space
ENV MOODLE_URL=https://scilms.pdn.ac.lk

RUN bun run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --no-log-init -g nodejs nextjs

COPY --from=builder /app/public ./public
# Automatically leverage output traces to reduce image size
# Learn more here: https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["bun", "server.js"]