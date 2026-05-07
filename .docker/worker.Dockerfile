FROM node:24

WORKDIR /workspace

COPY . .

RUN npm install -g wrangler
RUN npm install

ARG WORKER_NAME

WORKDIR /workspace/apps/${WORKER_NAME}

CMD ["npx", "wrangler", "dev", "--ip", "0.0.0.0"]