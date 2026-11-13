import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

import {
  getHonoursIntent,
  saveHonoursIntent,
  type HonoursIntent,
} from '@/repositories/honours-history.repo';
import type { Env } from '@/types/env';

test('D1 identity migration locks legacy students and preserves staff decisions', async () => {
  const database = new Database(':memory:');
  try {
    database.exec(
      await readFile(
        new URL('../migrations/0004_permissions.sql', import.meta.url),
        'utf8'
      )
    );
    const insert = database.prepare(
      `INSERT INTO permission (email, permissionJson, role, accessLevel, name)
       VALUES (?, ?, ?, ?, ?)`
    );
    insert.run(
      's21513@sci.pdn.ac.lk',
      JSON.stringify({ role: 'ACADEMIC', accessLevel: 'NONE' }),
      'ACADEMIC',
      'NONE',
      'Student'
    );
    insert.run(
      'staff@sci.pdn.ac.lk',
      JSON.stringify({ role: 'NON_ACADEMIC', accessLevel: 'ADMIN' }),
      'NON_ACADEMIC',
      'ADMIN',
      'Staff'
    );
    database.exec(
      await readFile(
        new URL('../migrations/0008_identity_review.sql', import.meta.url),
        'utf8'
      )
    );
    const student = database
      .query('SELECT role, permissionJson FROM permission WHERE email = ?')
      .get('s21513@sci.pdn.ac.lk') as {
      role: string;
      permissionJson: string;
    };
    expect(student.role).toBe('STUDENT');
    expect(JSON.parse(student.permissionJson)).toMatchObject({
      role: 'STUDENT',
    });
    expect(
      database.query('SELECT old_role, new_role FROM identity_audit').get()
    ).toMatchObject({ old_role: 'ACADEMIC', new_role: 'STUDENT' });
    expect(
      database
        .query('SELECT role, accessLevel FROM permission WHERE email = ?')
        .get('staff@sci.pdn.ac.lk')
    ).toMatchObject({ role: 'NON_ACADEMIC', accessLevel: 'ADMIN' });
    expect(
      database
        .query(
          "SELECT name FROM sqlite_master WHERE name = 'honours_operation_history'"
        )
        .get()
    ).toMatchObject({ name: 'honours_operation_history' });
  } finally {
    database.close();
  }
});

const postgresTest = process.env.POSTGRES_TEST_URL ? test : test.skip;

postgresTest(
  'PostgreSQL identity migration preserves existing staff and locks students',
  async () => {
    const schema = `identity_${crypto.randomUUID().replaceAll('-', '')}`;
    const admin = new Pool({ connectionString: process.env.POSTGRES_TEST_URL });
    const database = new Pool({
      connectionString: process.env.POSTGRES_TEST_URL,
      options: `-c search_path=${schema}`,
    });
    try {
      await admin.query(`CREATE SCHEMA "${schema}"`);
      const migrations = [
        '0001_better_auth.sql',
        '0002_auth_identity_uniqueness.sql',
        '0003_public_avatar_rate.sql',
        '0004_proxy_settings.sql',
        '0005_permissions.sql',
        '0006_public_avatar_moderation.sql',
      ];
      for (const file of migrations) {
        await database.query(
          await readFile(
            new URL(`../migrations/postgres/${file}`, import.meta.url),
            'utf8'
          )
        );
      }
      await database.query(
        `INSERT INTO permission (email, "permissionJson", role, "accessLevel", name)
       VALUES ($1, $2::jsonb, $3, $4, $5), ($6, $7::jsonb, $8, $9, $10)`,
        [
          's21513@sci.pdn.ac.lk',
          JSON.stringify({ role: 'ACADEMIC', accessLevel: 'NONE' }),
          'ACADEMIC',
          'NONE',
          'Student',
          'staff@sci.pdn.ac.lk',
          JSON.stringify({ role: 'NON_ACADEMIC', accessLevel: 'ADMIN' }),
          'NON_ACADEMIC',
          'ADMIN',
          'Staff',
        ]
      );
      await database.query(
        await readFile(
          new URL(
            '../migrations/postgres/0007_identity_review.sql',
            import.meta.url
          ),
          'utf8'
        )
      );
      const students = await database.query<{
        role: string;
        permissionJson: { role: string };
      }>('SELECT role, "permissionJson" FROM permission WHERE email = $1', [
        's21513@sci.pdn.ac.lk',
      ]);
      expect(students.rows[0]).toMatchObject({
        role: 'STUDENT',
        permissionJson: { role: 'STUDENT' },
      });
      const staff = await database.query(
        'SELECT role, "accessLevel" FROM permission WHERE email = $1',
        ['staff@sci.pdn.ac.lk']
      );
      expect(staff.rows[0]).toMatchObject({
        role: 'NON_ACADEMIC',
        accessLevel: 'ADMIN',
      });
      const audit = await database.query(
        'SELECT old_role, new_role FROM identity_audit'
      );
      expect(audit.rows).toMatchObject([
        { old_role: 'ACADEMIC', new_role: 'STUDENT' },
      ]);
      const operationId = `op_${'a'.repeat(64)}`;
      const apply = {
        batch: 's21',
        programme: 'STATISTICS',
        operation: 'assign',
        include: '801',
        exclude: '',
        additional: '',
        reason: 'Approved by department board',
        idempotencyKey: 'honours-postgres-restart-0001',
        expectedEntries: [
          {
            identifier: 'S21801',
            outcome: 'planned_assign',
            oldTrack: 'GENERAL',
            oldProgramme: null,
            newTrack: 'HONOURS',
            newProgramme: 'STATISTICS',
          },
        ],
        overwriteConflicts: false,
        confirmation: true,
      } as const;
      const originalEnv = { AUTH_DATABASE: database } as Env;
      const persistedIntent: HonoursIntent = {
        operationId,
        actorEmail: 'staff@sci.pdn.ac.lk',
        actorSubjectId: `usr_${'b'.repeat(64)}`,
        idempotencyKey: apply.idempotencyKey,
        correlationId: 'corr_1234567890123456',
        apply: { ...apply, expectedEntries: [...apply.expectedEntries] },
        requestHash: 'c'.repeat(64),
        batch: 's21',
        programme: 'STATISTICS',
        operation: 'assign',
        reason: apply.reason,
        changes: [
          {
            identifier: 'S21801',
            oldTrack: 'GENERAL',
            oldProgramme: null,
            newTrack: 'HONOURS',
            newProgramme: 'STATISTICS',
          },
        ],
        status: 'pending_acceptance',
        attemptCount: 0,
        createdAt: Date.now(),
      };
      await saveHonoursIntent(originalEnv, persistedIntent);
      expect(
        (
          await saveHonoursIntent(originalEnv, {
            ...persistedIntent,
            operationId: `op_${'d'.repeat(64)}`,
            idempotencyKey: 'honours-postgres-restart-0002',
            apply: {
              ...persistedIntent.apply,
              idempotencyKey: 'honours-postgres-restart-0002',
            },
          })
        ).operationId
      ).toBe(operationId);
      expect((await getHonoursIntent(originalEnv, operationId))?.status).toBe(
        'pending_acceptance'
      );
      const child = Bun.spawn(
        [
          'bun',
          fileURLToPath(
            new URL('./helpers/honours-reconcile-child.ts', import.meta.url)
          ),
          schema,
          operationId,
        ],
        {
          cwd: fileURLToPath(new URL('../', import.meta.url)),
          env: {
            ...process.env,
            POSTGRES_TEST_URL: process.env.POSTGRES_TEST_URL!,
          },
          stdout: 'pipe',
          stderr: 'pipe',
        }
      );
      const stderr = await new Response(child.stderr).text();
      expect(await child.exited).toBe(0);
      expect(stderr).toBe('');
      expect((await getHonoursIntent(originalEnv, operationId))?.status).toBe(
        'accepted'
      );
    } finally {
      await database.end();
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
  }
);
