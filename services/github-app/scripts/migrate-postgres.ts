import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolClient } from 'pg';
import { z } from 'zod';

const schemaName = z.string().regex(/^[a-z][a-z0-9_]*$/);
const config = z
  .object({
    POSTGRES_MIGRATION_URL: z
      .url()
      .refine((value) =>
        ['postgres:', 'postgresql:'].includes(new URL(value).protocol)
      ),
    API_POSTGRES_SCHEMA: schemaName,
    OPERATIONS_POSTGRES_SCHEMA: schemaName,
    PGBOSS_SCHEMA: schemaName,
    API_RUNTIME_ROLE: schemaName,
    OPERATIONS_RUNTIME_ROLE: schemaName,
  })
  .refine(
    (value) =>
      new Set([
        value.API_POSTGRES_SCHEMA,
        value.OPERATIONS_POSTGRES_SCHEMA,
        value.PGBOSS_SCHEMA,
      ]).size === 3,
    'All three PostgreSQL schemas must differ'
  )
  .parse(process.env);

const migrations = [
  {
    schema: config.API_POSTGRES_SCHEMA,
    runtimeRole: config.API_RUNTIME_ROLE,
    directory: new URL('../../api/migrations/postgres/', import.meta.url),
    filenames: [
      '0001_better_auth.sql',
      '0002_auth_identity_uniqueness.sql',
      '0003_public_avatar_rate.sql',
      '0004_proxy_settings.sql',
      '0005_permissions.sql',
      '0006_public_avatar_moderation.sql',
      '0007_identity_review.sql',
    ],
  },
  {
    schema: config.OPERATIONS_POSTGRES_SCHEMA,
    runtimeRole: config.OPERATIONS_RUNTIME_ROLE,
    directory: new URL('../migrations/postgres/', import.meta.url),
    filenames: [
      '0001_operation_state.sql',
      '0002_operation_dispatch_outbox.sql',
    ],
  },
] as const;

async function applyMigrations(
  client: PoolClient,
  target: (typeof migrations)[number]
): Promise<void> {
  const actual = (await readdir(target.directory))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  if (actual.join(',') !== [...target.filenames].sort().join(','))
    throw new Error(`Unreviewed migration files in ${target.schema}`);

  await client.query('BEGIN');
  try {
    const schema = await client.query(
      'SELECT 1 FROM pg_namespace WHERE nspname = $1',
      [target.schema]
    );
    if (schema.rowCount !== 1)
      throw new Error(`Bootstrap schema ${target.schema} before migration`);
    await client.query('SELECT set_config($1, quote_ident($2), true)', [
      'search_path',
      target.schema,
    ]);
    const existing = await client.query<{ table_name: string }>(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_type = $2',
      [target.schema, 'BASE TABLE']
    );
    if (
      existing.rows.length > 0 &&
      !existing.rows.some((row) => row.table_name === 'schema_migrations')
    )
      throw new Error(
        `${target.schema} has tables without a migration journal; review before adopting it`
      );

    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      sha256 TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    const applied = await client.query<{ filename: string; sha256: string }>(
      'SELECT filename, sha256 FROM schema_migrations'
    );
    const records = new Map(
      applied.rows.map((row) => [row.filename, row.sha256])
    );
    const known = new Set<string>(target.filenames);
    if (applied.rows.some((row) => !known.has(row.filename)))
      throw new Error(`Unknown applied migration in ${target.schema}`);

    for (const filename of target.filenames) {
      const sql = await readFile(new URL(filename, target.directory), 'utf8');
      const sha256 = createHash('sha256').update(sql).digest('hex');
      const previous = records.get(filename);
      if (previous && previous !== sha256)
        throw new Error(
          `Applied migration changed: ${target.schema}/${filename}`
        );
      if (previous) continue;
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename, sha256) VALUES ($1, $2)',
        [filename, sha256]
      );
      console.log(`Applied ${target.schema}/${filename}`);
    }
    await client.query(
      `REVOKE ALL ON TABLE schema_migrations FROM "${target.runtimeRole}"`
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

const pool = new Pool({
  connectionString: config.POSTGRES_MIGRATION_URL,
  max: 1,
  connectionTimeoutMillis: 5_000,
});
const client = await pool.connect();
try {
  // Hold one session lock across both application schemas and the official queue CLI.
  await client.query('SELECT pg_advisory_lock(1048573, 7)');
  for (const target of migrations) await applyMigrations(client, target);

  const child = Bun.spawn(
    ['bun', 'node_modules/pg-boss/dist/cli.js', 'migrate'],
    {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      env: {
        ...process.env,
        PGBOSS_DATABASE_URL: config.POSTGRES_MIGRATION_URL,
        PGBOSS_SCHEMA: config.PGBOSS_SCHEMA,
      },
      stdout: 'inherit',
      stderr: 'inherit',
    }
  );
  if ((await child.exited) !== 0) throw new Error('pg-boss migration failed');
  console.log('PostgreSQL schemas are current');
} finally {
  try {
    await client.query('SELECT pg_advisory_unlock(1048573, 7)');
  } finally {
    client.release();
    await pool.end();
  }
}
