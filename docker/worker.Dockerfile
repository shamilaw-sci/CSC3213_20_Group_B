# -----------------------------------------------------------------------------
# Cloudflare Workers Dockerfile for Monorepo Apps
# -----------------------------------------------------------------------------

# Use Node.js base image
FROM node:24 AS base

# Set working directory
WORKDIR /workspace

# -----------------------------------------------------------------------------
# Dependencies
# -----------------------------------------------------------------------------

FROM base AS deps

# Copy dependency manifests first for better layer caching
COPY package.json package-lock.json* ./

# Install Wrangler globally
RUN npm install -g wrangler

# Install project dependencies
RUN npm install

# -----------------------------------------------------------------------------
# Development Runner
# -----------------------------------------------------------------------------

FROM base AS runner

# Runtime worker name argument
ARG WORKER_NAME

# Runtime environment variables
ENV NODE_ENV=development
ENV PORT=8787
ENV HOSTNAME=0.0.0.0

# Copy installed dependencies
COPY --from=deps /workspace/node_modules ./node_modules

# Copy source code
COPY . .

# Switch to target worker app
WORKDIR /workspace/apps/${WORKER_NAME}

# Expose Wrangler dev server port
EXPOSE 8787

# Start Cloudflare Worker development server
CMD ["sh", "-c", "npx wrangler dev --ip 0.0.0.0 --port $PORT"]