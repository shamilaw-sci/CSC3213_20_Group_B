import { createS3Store } from '@scs/storage/s3';
import { z } from 'zod';

import { createPostgresAuthDatabase } from '@/config/postgres-auth-database';
import { createPostgresRelationalBindings } from '@/config/postgres-relational-bindings';
import { handleApiRequest } from '@/index';
import { bindBackgroundTaskHandler } from '@/runtime/request-context';
import { createSharpAvatarImageProcessor } from '@/services/avatar-image-processor-sharp';
import type { Env } from '@/types/env';

const databaseUrl = z
  .url()
  .refine(
    (value) =>
      URL.canParse(value) &&
      ['postgres:', 'postgresql:'].includes(new URL(value).protocol)
  );
const schema = z.string().regex(/^[a-z][a-z0-9_]*$/);
const config = z
  .object({
    POSTGRES_URL: databaseUrl,
    POSTGRES_SCHEMA: schema,
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    MAILER_API_URL: z.url(),
    MAILER_API_KEY: z.string().min(1),
    GITHUB_APP_API_URL: z.url(),
    GITHUB_APP_INTERNAL_SECRET: z.string().min(1),
    DATA_PUBLIC_BASE_URL: z.url(),
    WEB_PROXY_INTERNAL_SECRET: z.string().min(1),
    TYPESAFE_API_KEY: z.string().min(1),
    AVATAR_S3_BUCKET: z.string().min(1),
    AVATAR_S3_REGION: z.string().min(1),
    AVATAR_S3_ENDPOINT: z.url(),
    AVATAR_S3_ACCESS_KEY_ID: z.string().min(1),
    AVATAR_S3_SECRET_ACCESS_KEY: z.string().min(1),
  })
  .parse(process.env);

const pool = createPostgresAuthDatabase({
  connectionString: config.POSTGRES_URL,
  schema: config.POSTGRES_SCHEMA,
});
const storage = createS3Store({
  driver: 's3',
  bucket: config.AVATAR_S3_BUCKET,
  region: config.AVATAR_S3_REGION,
  endpoint: config.AVATAR_S3_ENDPOINT,
  accessKeyId: config.AVATAR_S3_ACCESS_KEY_ID,
  secretAccessKey: config.AVATAR_S3_SECRET_ACCESS_KEY,
  forcePathStyle: true,
});
const env: Env = {
  ...config,
  ...createPostgresRelationalBindings(pool),
  AVATAR_STORAGE: storage,
  AVATAR_IMAGE_PROCESSOR: createSharpAvatarImageProcessor(),
};

const backgroundTasks = new Set<Promise<unknown>>();
let ready = false;
let stopping = false;
let server: ReturnType<typeof Bun.serve> | undefined;

async function shutdown(): Promise<void> {
  if (stopping) return;
  stopping = true;
  ready = false;
  await server?.stop();
  await Promise.allSettled(backgroundTasks);
  await pool.end();
}

function handleSignal(): void {
  void shutdown().then(
    () => process.exit(0),
    (error: unknown) => {
      console.error('API shutdown failed', error);
      process.exit(1);
    }
  );
}

try {
  const tables = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM (VALUES
      ('user'), ('session'), ('account'), ('verification'), ('passkey'),
      ('rateLimit'), ('permission'), ('proxySettings'), ('public_avatar_rate'),
      ('public_avatar_review'), ('public_avatar_audit')
    ) AS required(name) WHERE to_regclass(quote_ident(name)) IS NOT NULL`
  );
  if (tables.rows[0]?.count !== '11')
    throw new Error('PostgreSQL API migrations 0001 through 0006 are required');
  await storage.head('__scs_readiness__');
  server = Bun.serve({
    port: config.API_PORT,
    fetch(request, serverInstance) {
      const path = new URL(request.url).pathname;
      if (path === '/healthz') return Response.json({ status: 'ok' });
      if (path === '/readyz')
        return Response.json({ ready }, { status: ready ? 200 : 503 });
      if (!ready)
        return Response.json({ error: 'Service unavailable' }, { status: 503 });

      // Never trust a client-supplied Cloudflare IP header on a direct Bun listener.
      const headers = new Headers(request.headers);
      headers.delete('cf-connecting-ip');
      const address = serverInstance.requestIP(request)?.address;
      if (address) headers.set('cf-connecting-ip', address);
      const trustedRequest = new Request(request, { headers });
      bindBackgroundTaskHandler(trustedRequest, (promise) => {
        const tracked = promise.catch((error: unknown) =>
          console.error('Background auth task failed:', error)
        );
        backgroundTasks.add(tracked);
        void tracked.finally(() => backgroundTasks.delete(tracked));
      });
      return handleApiRequest(trustedRequest, env);
    },
  });
  process.once('SIGINT', handleSignal);
  process.once('SIGTERM', handleSignal);
  ready = true;
  console.log(`API listening on port ${config.API_PORT}`);
} catch (error) {
  await shutdown();
  throw error;
}
