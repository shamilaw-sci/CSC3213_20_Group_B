# Docker Setup Guide

## Quick Start (Pick One)

**For Local Development:**

```bash
docker-compose up -d
```

Uses separate Dockerfiles in `docker/` folder with hot-reload.

**For Production:**

```bash
docker build -t image:latest .
docker run -d -p 3000:3000 -p 3001:3001 -p 3002:3002 -p 3003:3003 -p 3004:3004 -p 8787:8787 -p 8788:8788 -p 8789:8789 image:latest
```

Uses single root `Dockerfile` with all services in one container.

**From Pre-built Image:**

```bash
docker pull ghcr.io/shamilaw-sci/csc3213_20_group_b:latest
docker run -d -p 3000:3000 -p 3001:3001 -p 3002:3002 -p 3003:3003 -p 3004:3004 -p 8787:8787 -p 8788:8788 -p 8789:8789 ghcr.io/shamilaw-sci/csc3213_20_group_b:latest
```

## Two Docker Approaches

|                 | **Local Dev (docker-compose)**                                                 | **Production (root Dockerfile)** |
| --------------- | ------------------------------------------------------------------------------ | -------------------------------- |
| **Build**       | `docker-compose build`                                                         | `docker build .`                 |
| **Run**         | `docker-compose up -d`                                                         | `docker run ...`                 |
| **Dockerfiles** | `docker/next.Dockerfile`, `docker/hono.Dockerfile`, `docker/worker.Dockerfile` | Single `Dockerfile`              |
| **When to use** | Local development with hot-reload                                              | Production deployment            |

## Services & Ports

| App       | Port | URL                                            |
| --------- | ---- | ---------------------------------------------- |
| Main Site | 3001 | [http://localhost:3001](http://localhost:3001) |
| Portal    | 3002 | [http://localhost:3002](http://localhost:3002) |
| People    | 3003 | [http://localhost:3003](http://localhost:3003) |
| Projects  | 3004 | [http://localhost:3004](http://localhost:3004) |

### Backend Services

| Service      | Port | URL                                            | Type       |
| ------------ | ---- | ---------------------------------------------- | ---------- |
| API          | 3000 | [http://localhost:3000](http://localhost:3000) | Hono (Bun) |
| GitHub App   | 8789 | [http://localhost:8789](http://localhost:8789) | Hono (Bun) |
| Auth Worker  | 8787 | [http://localhost:8787](http://localhost:8787) | Cloudflare |
| Proxy Worker | 8788 | [http://localhost:8788](http://localhost:8788) | Cloudflare |

## Docker Compose Commands

```bash
docker-compose up -d              # Start all services
docker-compose down               # Stop and remove services
docker-compose logs -f            # View logs
docker-compose logs -f api        # View specific service logs
docker-compose build --no-cache   # Rebuild without cache
docker-compose ps                 # List services status
docker-compose exec api sh        # Access service shell
```

## Common Docker Commands

```bash
docker ps                    # List running containers
docker logs -f <id>         # View container logs
docker stop <id>            # Stop container
docker rm <id>              # Remove container
docker system prune -a       # Clean up everything
```

## Troubleshooting

| Issue                     | Solution                                                         |
| ------------------------- | ---------------------------------------------------------------- |
| Port already in use       | Change port in `docker-compose.yml` or use `docker-compose stop` |
| Container won't start     | Check logs: `docker-compose logs <service>`                      |
| Image pull fails          | Check internet connection and image name                         |
| Permission denied         | Use `sudo` or add user to docker group                           |
| File changes not detected | Restart service: `docker-compose restart <service>`              |
| Out of disk space         | Run: `docker system prune -a --volumes`                          |

## Notes

- **Local Dev**: `docker-compose.yml` uses `docker/` Dockerfiles with hot-reload
- **Environment**: Set `WATCHPACK_POLLING=true` and `CHOKIDAR_USEPOLLING=true` for file watching
- **Pre-built**: Pull from GHCR: `ghcr.io/shamilaw-sci/csc3213_20_group_b:latest`
