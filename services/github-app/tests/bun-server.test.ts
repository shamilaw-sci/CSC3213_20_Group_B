import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const resolveFromService = createRequire(import.meta.url);
const pgBossCli = resolveFromService.resolve('pg-boss/dist/cli.js');
const postgresTest = process.env.POSTGRES_TEST_URL ? test : test.skip;

postgresTest(
  'Bun GitHub App starts against migrated PostgreSQL, serves status, and shuts down',
  async () => {
    const connectionString = process.env.POSTGRES_TEST_URL!;
    const schema = `phase6_${crypto.randomUUID().replaceAll('-', '')}`;
    const queueSchema = `${schema}_jobs`;
    const port = 16060 + Math.floor(Math.random() * 1000);
    const admin = new Pool({ connectionString });
    const pool = new Pool({
      connectionString,
      options: `-c search_path=${schema}`,
    });
    let child: ReturnType<typeof Bun.spawn> | undefined;
    try {
      await admin.query(`CREATE SCHEMA "${schema}"`);
      for (const filename of [
        '0001_operation_state.sql',
        '0002_operation_dispatch_outbox.sql',
      ]) {
        await pool.query(
          await readFile(
            new URL(`../migrations/postgres/${filename}`, import.meta.url),
            'utf8'
          )
        );
      }
      const migrate = Bun.spawnSync(['bun', pgBossCli, 'migrate'], {
        cwd: fileURLToPath(new URL('../', import.meta.url)),
        env: {
          ...process.env,
          PGBOSS_DATABASE_URL: connectionString,
          PGBOSS_SCHEMA: queueSchema,
        },
      });
      if (migrate.exitCode !== 0)
        throw new Error(new TextDecoder().decode(migrate.stderr));
      child = Bun.spawn(['bun', 'src/server.ts'], {
        cwd: fileURLToPath(new URL('../', import.meta.url)),
        env: {
          ...process.env,
          POSTGRES_URL: connectionString,
          POSTGRES_SCHEMA: schema,
          PGBOSS_SCHEMA: queueSchema,
          PORT: String(port),
          GITHUB_APP_ID: '1',
          GITHUB_PRIVATE_KEY: 'test-key',
          GITHUB_INSTALLATION_ID: '1',
          GITHUB_OWNER: 'test-owner',
          GITHUB_PEOPLE_DATA_REPOSITORY: 'data',
          GITHUB_PROJECTS_DATA_REPOSITORY: 'data',
          X_INTERNAL_SECRET: 'phase6-test-secret',
        },
        stdout: 'pipe',
        stderr: 'pipe',
      });
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if (child.exitCode !== null) break;
        try {
          ready =
            (await fetch(`http://127.0.0.1:${port}/readyz`)).status === 200;
        } catch {
          /* startup in progress */
        }
        if (ready) break;
        await Bun.sleep(100);
      }
      if (!ready)
        throw new Error(
          `GitHub App did not become ready: ${child.stderr instanceof ReadableStream ? await new Response(child.stderr).text() : 'process exited'}`
        );
      expect((await fetch(`http://127.0.0.1:${port}/healthz`)).status).toBe(
        200
      );
      expect((await fetch(`http://127.0.0.1:${port}/`)).status).toBe(401);
      expect(
        (
          await fetch(`http://127.0.0.1:${port}/`, {
            headers: { 'X-Internal-Secret': 'phase6-test-secret' },
          })
        ).status
      ).toBe(200);
      child.kill('SIGTERM');
      // Bun's Windows subprocess API terminates directly; POSIX runs the signal handler.
      expect(await child.exited).toBe(process.platform === 'win32' ? 143 : 0);
      child = undefined;
    } finally {
      if (child) {
        child.kill('SIGTERM');
        await child.exited;
      }
      await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS "${queueSchema}" CASCADE`);
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
  },
  30_000
);
