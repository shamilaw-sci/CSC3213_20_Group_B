# Docker

This folder contains configuration and instructions for running the site with Docker.

## Files of interest

- [`Dockerfile`](../Dockerfile)
- [`docker-compose.yml`](docker-compose.yml)
- `production.env`

## Prerequisites

- Docker Engine and Docker CLI
- Docker Compose v2 (`docker compose`)

## Build the image locally

From the repository root:

```bash
docker build \
  -t people.scs.pdn.ac.lk:latest \
  -f Dockerfile \
  .
```

## Run the locally built image

```bash
docker run --rm \
  -p 3000:3000 \
  --name people-scs-pdn-ac-lk \
  people.scs.pdn.ac.lk:latest
```

The application will be available at:

```text
http://localhost:3000
```

## Run using Docker Compose

The Compose configuration uses the prebuilt container image published to GitHub Container Registry:

```text
ghcr.io/csc3213-2026-group-b/people.scs.pdn.ac.lk
```

From this folder:

```bash
docker compose pull
docker compose up -d
```

The service is bound to:

```text
127.0.0.1:3000
```

This means it is accessible only from the host machine unless exposed through a reverse proxy such as Nginx.

## Image versions

By default, Compose uses the `latest` image:

```bash
docker compose up -d
```

A specific image tag can be selected with `IMAGE_TAG`:

```bash
IMAGE_TAG=v1.2.0 docker compose up -d
```

## Environment configuration

The application reads production environment variables from:

```text
production.env
```

The Compose configuration also sets:

```text
NODE_ENV=production
PORT=3000
```

See the project's `src/config` directory for application-specific configuration.

## Updating the deployment

Pull the latest image and recreate the container:

```bash
docker compose pull
docker compose up -d --force-recreate
```

Or:

```bash
docker compose pull && docker compose up -d --force-recreate
```

## Useful commands

View running containers:

```bash
docker compose ps
```

View logs:

```bash
docker compose logs -f
```

Restart the service:

```bash
docker compose restart
```

Stop and remove the container:

```bash
docker compose down
```

Pull the latest container image:

```bash
docker compose pull
```

## Troubleshooting

If port `3000` is already in use, change the host-side port mapping in `docker-compose.yml`:

```yaml
ports:
  - '127.0.0.1:3001:3000'
```

If the container fails to start, inspect its logs:

```bash
docker compose logs -f
```

If the latest published image is not being used, explicitly pull it before recreating the service:

```bash
docker compose pull
docker compose up -d --force-recreate
```

For development with Bun or Next.js hot reload, running the application directly on the host is generally faster than rebuilding or restarting Docker containers after each change.
