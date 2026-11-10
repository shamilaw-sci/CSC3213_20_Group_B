import { Pool } from 'pg';

import { PostgresMutationCoordinator } from '@/operations/postgres-mutation-coordinator';

const pool = new Pool({ connectionString: process.env.POSTGRES_TEST_URL });
const coordinator = new PostgresMutationCoordinator(pool);

await coordinator.runExclusive(
  'project:process-crash',
  'operation-process-001',
  async () => {
    process.stdout.write('LOCKED\n');
    await new Promise<void>(() => {});
  }
);
