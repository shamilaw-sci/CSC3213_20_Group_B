import { createS3Store } from '@scs/storage/s3';
import { z } from 'zod';

import { createPostgresAuthDatabase } from '@/config/postgres-auth-database';
import { createPostgresRelationalBindings } from '@/config/postgres-relational-bindings';
import { handleApiRequest } from '@/index';
import { trustedClientHeaders } from '@/runtime/bun/client-ip';
import { bindBackgroundTaskHandler } from '@/runtime/request-context';
import { createSharpAvatarImageProcessor } from '@/services/avatar-image-processor-sharp';
import { reconcileDueHonoursIntents } from '@/services/honours.service';
import type { Env } from '@/types/env';

const databaseUrl = z
  .url()
  .refine(
    (value) =>
      URL.canParse(value) &&
      ['postgres:', 'postgresql:'].includes(new URL(value).protocol)
  );
const schema = z.string().regex(/^[a-z][a-z0-9_]*$/);
const httpsOrigin = z.url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === 'https:' &&
    url.pathname === '/' &&
    !url.search &&
    !url.hash
  );
});
const config = z
  .object({
    POSTGRES_URL: databaseUrl,
    POSTGRES_SCHEMA: schema,
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    PORTAL_ORIGIN: httpsOrigin,
    AUTH_COOKIE_DOMAIN: z.string().regex(/^\.[a-z0-9.-]+$/),
    TRUSTED_PROXY_IP: z.union([z.ipv4(), z.ipv6()]).optional(),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    ORCID_CLIENT_ID: z.string().min(1).optional(),
    ORCID_CLIENT_SECRET: z.string().min(1).optional(),
    MAILER_API_URL: z.url(),
    MAILER_API_KEY: z.string().min(1),
    GITHUB_APP_API_URL: z.url(),
    GITHUB_APP_INTERNAL_SECRET: z.string().min(1),
    DATA_PUBLIC_BASE_URL: z.url(),
    WEB_PROXY_INTERNAL_SECRET: z.string().min(1),
    TYPESAFE_API_KEY: z.string().min(1),
    IDENTITY_JEV_ENABLED: z.enum(['true', 'false']).default('false'),
    AVATAR_S3_BUCKET: z.string().min(1),
    AVATAR_S3_REGION: z.string().min(1),
    AVATAR_S3_ENDPOINT: z.url(),
    AVATAR_S3_ACCESS_KEY_ID: z.string().min(1),
    AVATAR_S3_SECRET_ACCESS_KEY: z.string().min(1),
  })
  .superRefine((value, ctx) => {
    const portalHost = new URL(value.PORTAL_ORIGIN).hostname;
    const apiHost = new URL(value.BETTER_AUTH_URL).hostname;
    const expectedDomain = portalHost.replace(/^portal\./, '.');
    const localTestApi =
      new URL(value.BETTER_AUTH_URL).protocol === 'http:' &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(apiHost);
    if (
      !portalHost.startsWith('portal.') ||
      value.AUTH_COOKIE_DOMAIN !== expectedDomain ||
      (apiHost !== `api.${expectedDomain.slice(1)}` && !localTestApi)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_COOKIE_DOMAIN'],
        message:
          'Portal and API origins must share the configured cookie domain',
      });
    }
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
  ALLOWED_ORIGINS: [config.PORTAL_ORIGIN],
  PASSKEY_RP_ID: new URL(config.PORTAL_ORIGIN).hostname,
  AUTH_COOKIE_DOMAIN: config.AUTH_COOKIE_DOMAIN,
};

const backgroundTasks = new Set<Promise<unknown>>();
let ready = false;
let stopping = false;
let server: ReturnType<typeof Bun.serve> | undefined;
let honoursRecoveryTimer: ReturnType<typeof setInterval> | undefined;

async function shutdown(): Promise<void> {
  if (stopping) return;
  stopping = true;
  ready = false;
  if (honoursRecoveryTimer) clearInterval(honoursRecoveryTimer);
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
      ('public_avatar_review'), ('public_avatar_audit'),
      ('identity_review'), ('identity_audit'), ('honours_operation_history'),
      ('orcid_link_intent')
    ) AS required(name) WHERE to_regclass(quote_ident(name)) IS NOT NULL`
  );
  if (tables.rows[0]?.count !== '15')
    throw new Error('PostgreSQL API migrations 0001 through 0008 are required');
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

      const address = serverInstance.requestIP(request)?.address;
      const headers = trustedClientHeaders(
        request.headers,
        address,
        config.TRUSTED_PROXY_IP
      );
      if (!headers)
        return Response.json(
          { error: 'Invalid client address' },
          { status: 400 }
        );
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
  const recoverHonours = () => {
    const task = reconcileDueHonoursIntents(env).catch((error: unknown) =>
      console.error('Honours intent recovery failed', error)
    );
    backgroundTasks.add(task);
    void task.finally(() => backgroundTasks.delete(task));
  };
  recoverHonours();
  honoursRecoveryTimer = setInterval(recoverHonours, 60_000);
  console.log(`API listening on port ${config.API_PORT}`);
} catch (error) {
  await shutdown();
  throw error;
}
