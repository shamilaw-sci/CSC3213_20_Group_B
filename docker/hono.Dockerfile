# -----------------------------------------------------------------------------
# Hono.js Dockerfile for Bun Monorepo Apps
# -----------------------------------------------------------------------------

# Use Bun official image
FROM oven/bun:1.3.1

# Set workspace root
WORKDIR /workspace

# Copy entire monorepo
COPY . .

# Install dependencies
RUN bun install

# Target app name
ARG APP_NAME

# Switch to selected app
WORKDIR /workspace/apps/${APP_NAME}

# Runtime environment variables
ENV NODE_ENV=development
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Expose Hono app port
EXPOSE 3000

# Start Hono development server
CMD ["bun", "run", "dev"]