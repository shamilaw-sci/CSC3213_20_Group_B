import { createEnv } from '@t3-oss/env-core';
import { PgBoss } from 'pg-boss';
import { Pool } from 'pg';
import { z } from 'zod';

import app from '@/app';
import {
  parseRuntimeConfig,
  runWithRuntimeConfig,
} from '@/config/runtime.config';
import { classifyGithubError } from '@/github/github.errors';
import { operationHandlers } from '@/operations/operation.handlers';
import { OperationExecutor } from '@/operations/operation.executor';
import { PostgresMutationCoordinator } from '@/operations/postgres-mutation-coordinator';
import {
  PostgresOperationDispatcher,
  PostgresOperationWorker,
  preparePostgresOperationQueues,
} from '@/operations/postgres-operation-queue';
import { PostgresOperationStore } from '@/operations/postgres-operation.store';
import type { GithubAppEnv } from '@/types/env';

const databaseUrl = z
  .url()
  .refine(
    (value) =>
      URL.canParse(value) &&
      ['postgres:', 'postgresql:'].includes(new URL(value).protocol)
  );
const schemaName = z.string().regex(/^[a-z][a-z0-9_]*$/);

const processEnv = createEnv({
  server: {
    GITHUB_APP_ID: z.string().min(1),
    GITHUB_PRIVATE_KEY: z.string().min(1),
    GITHUB_INSTALLATION_ID: z.string().min(1),
    GITHUB_OWNER: z.string().min(1),
    GITHUB_PEOPLE_DATA_REPOSITORY: z.string().min(1),
    GITHUB_PROJECTS_DATA_REPOSITORY: z.string().min(1),
    X_INTERNAL_SECRET: z.string().min(1),
    POSTGRES_URL: databaseUrl,
    POSTGRES_SCHEMA: schemaName,
    PGBOSS_SCHEMA: schemaName,
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

if (processEnv.POSTGRES_SCHEMA === processEnv.PGBOSS_SCHEMA)
  throw new Error('POSTGRES_SCHEMA and PGBOSS_SCHEMA must differ');

const runtimeConfig = parseRuntimeConfig(processEnv);
const pool = new Pool({
  connectionString: processEnv.POSTGRES_URL,
  options: `-c search_path=${processEnv.POSTGRES_SCHEMA}`,
  connectionTimeoutMillis: 5_000,
});
const boss = new PgBoss({
  connectionString: processEnv.POSTGRES_URL,
  schema: processEnv.PGBOSS_SCHEMA,
  connectionTimeoutMillis: 5_000,
});
const store = new PostgresOperationStore(pool, { dispatchOutbox: true });
const dispatcher = new PostgresOperationDispatcher(pool, boss);
const executor = new OperationExecutor({
  store,
  coordinator: new PostgresMutationCoordinator(pool),
  handlers: runWithRuntimeConfig(runtimeConfig, operationHandlers),
  classifyError: classifyGithubError,
  dispatch: dispatcher,
});
const worker = new PostgresOperationWorker(boss, dispatcher, executor);
const bindings: GithubAppEnv = {
  ...runtimeConfig,
  OPERATION_STORE: store,
  OPERATION_EXECUTOR: executor,
};

let ready = false;
let server: ReturnType<typeof Bun.serve> | undefined;
let stopping = false;

async function shutdown(): Promise<void> {
  if (stopping) return;
  stopping = true;
  ready = false;
  await server?.stop();
  try {
    await worker.stop();
  } finally {
    try {
      await boss.stop();
    } finally {
      await pool.end();
    }
  }
}

function handleSignal(): void {
  void shutdown().then(
    () => process.exit(0),
    (error: unknown) => {
      console.error('GitHub App shutdown failed', error);
      process.exit(1);
    }
  );
}

try {
  const database = await pool.query<{
    state: string | null;
    outbox: string | null;
  }>(
    `SELECT to_regclass('operation_state')::text AS state,
            to_regclass('operation_dispatch_outbox')::text AS outbox`
  );
  if (!database.rows[0]?.state || !database.rows[0]?.outbox)
    throw new Error(
      'PostgreSQL operation migrations 0001 and 0002 are required'
    );
  await boss.start();
  await preparePostgresOperationQueues(boss);
  await worker.start();
  server = Bun.serve({
    port: runtimeConfig.PORT,
    fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === '/healthz') return Response.json({ status: 'ok' });
      if (path === '/readyz')
        return Response.json({ ready }, { status: ready ? 200 : 503 });
      if (!ready)
        return Response.json({ error: 'Service unavailable' }, { status: 503 });
      return runWithRuntimeConfig(runtimeConfig, () =>
        app.fetch(request, bindings)
      );
    },
  });
  process.once('SIGINT', handleSignal);
  process.once('SIGTERM', handleSignal);
  ready = true;
  console.log(`GitHub App listening on port ${runtimeConfig.PORT}`);
} catch (error) {
  await shutdown();
  throw error;
}
