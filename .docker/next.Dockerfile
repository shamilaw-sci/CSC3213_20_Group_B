FROM oven/bun:1.3.1

WORKDIR /workspace

COPY . .

RUN bun install

ARG APP_NAME

WORKDIR /workspace/apps/${APP_NAME}

CMD ["bun", "run", "dev"]