import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const postgresTest = process.env.POSTGRES_TEST_URL ? test : test.skip;

postgresTest(
  'reviewed migrations are repeatable and reject drift',
  async () => {
    const connectionString = process.env.POSTGRES_TEST_URL!;
    const suffix = crypto.randomUUID().replaceAll('-', '');
    const api = `phase7_api_${suffix}`;
    const operations = `phase7_operations_${suffix}`;
    const jobs = `phase7_jobs_${suffix}`;
    const runtimeRole = `phase7_runtime_${suffix}`;
    const admin = new Pool({ connectionString });
    const run = async () => {
      const child = Bun.spawn(['bun', 'scripts/migrate-postgres.ts'], {
        cwd: fileURLToPath(new URL('../', import.meta.url)),
        env: {
          ...process.env,
          POSTGRES_MIGRATION_URL: connectionString,
          API_POSTGRES_SCHEMA: api,
          OPERATIONS_POSTGRES_SCHEMA: operations,
          PGBOSS_SCHEMA: jobs,
          API_RUNTIME_ROLE: runtimeRole,
          OPERATIONS_RUNTIME_ROLE: runtimeRole,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const [code, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      return { code, output: `${stdout}${stderr}` };
    };
    try {
      await admin.query(`CREATE ROLE "${runtimeRole}"`);
      await admin.query(`CREATE SCHEMA "${api}"`);
      await admin.query(`CREATE SCHEMA "${operations}"`);
      await admin.query(`CREATE SCHEMA "${jobs}"`);
      const concurrent = await Promise.all([run(), run()]);
      expect(concurrent.map((result) => result.code)).toEqual([0, 0]);
      expect(
        concurrent.filter((result) => result.output.includes('Applied '))
      ).toHaveLength(1);
      const second = await run();
      expect(second.code).toBe(0);
      expect(second.output).not.toContain('Applied ');
      const rows = await admin.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM "${api}".schema_migrations`
      );
      expect(rows.rows[0]?.count).toBe('7');
      await admin.query(
        `GRANT ALL ON TABLE "${api}".schema_migrations TO "${runtimeRole}"`
      );
      expect((await run()).code).toBe(0);
      const grant = await admin.query<{ granted: boolean }>(
        'SELECT has_table_privilege($1, $2, $3) AS granted',
        [runtimeRole, `${api}.schema_migrations`, 'UPDATE']
      );
      expect(grant.rows[0]?.granted).toBe(false);
      await admin.query(
        `UPDATE "${api}".schema_migrations SET sha256 = $1 WHERE filename = $2`,
        ['invalid', '0001_better_auth.sql']
      );
      const drift = await run();
      expect(drift.code).not.toBe(0);
      expect(drift.output).toContain('Applied migration changed');
    } finally {
      await admin.query(`DROP SCHEMA IF EXISTS "${jobs}" CASCADE`);
      await admin.query(`DROP SCHEMA IF EXISTS "${operations}" CASCADE`);
      await admin.query(`DROP SCHEMA IF EXISTS "${api}" CASCADE`);
      await admin.query(`DROP ROLE IF EXISTS "${runtimeRole}"`);
      await admin.end();
    }
  },
  30_000
);
