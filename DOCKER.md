# Docker Setup Guide

This guide explains how to run the SCS PDN monorepo applications using Docker.

## Quick Start

You can run the applications using Docker in two ways:

### Option A: Pull from GitHub Container Registry (Recommended)

Pull the latest pre-built image from GHCR:

```bash
docker pull ghcr.io/shamilaw-sci/csc3213_20_group_b:latest
```

Then run the container:

```bash
docker run -d \
  -p 3000:3000 \
  -p 3001:3001 \
  -p 3002:3002 \
  -p 3003:3003 \
  -p 3004:3004 \
  ghcr.io/shamilaw-sci/csc3213_20_group_b:latest
```

### Option B: Build Docker Image Locally

Build the Docker image from source:

```bash
docker build -t csc3213_20_group_b:latest .
```

Then run the container:

```bash
docker run -d \
  -p 3000:3000 \
  -p 3001:3001 \
  -p 3002:3002 \
  -p 3003:3003 \
  -p 3004:3004 \
  csc3213_20_group_b:latest
```

## Accessing the Applications

Once the Docker container is running, access the applications at:

| App       | URL                                            |
| --------- | ---------------------------------------------- |
| Main Site | [http://localhost:3001](http://localhost:3001) |
| Portal    | [http://localhost:3002](http://localhost:3002) |
| People    | [http://localhost:3003](http://localhost:3003) |
| Projects  | [http://localhost:3004](http://localhost:3004) |
| API       | [http://localhost:3000](http://localhost:3000) |

## Managing Docker Containers

### Stop the Container

```bash
docker stop <container_id>
```

To find the container ID:

```bash
docker ps
```

### Remove the Container

```bash
docker rm <container_id>
```

### View Container Logs

```bash
docker logs -f <container_id>
```

## Advanced Usage

### Custom Port Mapping

If port 3001 or other ports are already in use, map them to different ports:

```bash
docker run -d \
  -p 8001:3001 \
  -p 8002:3002 \
  -p 8003:3003 \
  -p 8004:3004 \
  -p 8000:3000 \
  ghcr.io/shamilaw-sci/csc3213_20_group_b:latest
```

### Building for a Specific App

To build individual app Docker images:

```bash
# Main site
docker build -t csc3213_20_group_b:main-site ./apps/main-site -f ./apps/main-site/Dockerfile

# Portal
docker build -t csc3213_20_group_b:portal ./apps/portal -f ./apps/portal/Dockerfile

# API
docker build -t csc3213_20_group_b:api ./apps/api -f ./apps/api/Dockerfile
```

## Troubleshooting

| Issue                       | Solution                                                                        |
| --------------------------- | ------------------------------------------------------------------------------- |
| Port already in use         | Use custom port mapping (see Advanced Usage) or stop the conflicting container  |
| Image pull fails            | Ensure you have internet access and the image name is correct                   |
| Container exits immediately | Check logs with `docker logs <container_id>` to see error messages              |
| Permission denied           | Run Docker commands with appropriate permissions (may need `sudo` on Linux/Mac) |
