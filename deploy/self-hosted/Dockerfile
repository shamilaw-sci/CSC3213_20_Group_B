FROM oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS base
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile

FROM base AS backend
USER bun

FROM base AS next
ARG APP
ARG SITE_DOMAIN
ARG MOODLE_URL=https://scilms.pdn.ac.lk
RUN APP="$APP" SITE_DOMAIN="$SITE_DOMAIN" MOODLE_URL="$MOODLE_URL" \
    sh deploy/self-hosted/build-next.sh
RUN chown -R bun:bun "/app/apps/${APP}"
USER bun
