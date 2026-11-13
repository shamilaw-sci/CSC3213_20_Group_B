import { Pool } from 'pg';

import { reconcileDueHonoursIntents } from '@/services/honours.service';
import type { Env } from '@/types/env';

const [schema, operationId] = process.argv.slice(2);
if (!schema || !operationId || !/^[a-z0-9_]+$/.test(schema))
  throw new Error('A test schema and operation ID are required');

const database = new Pool({
  connectionString: process.env.POSTGRES_TEST_URL,
  options: `-c search_path=${schema}`,
});
try {
  const env = {
    AUTH_DATABASE: database,
    GITHUB_APP_API_URL: 'https://github-app.invalid',
    GITHUB_APP_INTERNAL_SECRET: 'test',
    GITHUB_APP: {
      fetch: async (request: Request) =>
        Response.json({
          version: 1,
          operationId,
          resource: { type: 'honours_batch', id: 's21' },
          actor: {
            type: 'user',
            subjectId: request.headers.get('X-Actor-Subject-Id'),
          },
          status: 'queued',
          createdAt: '2026-11-13T00:00:00Z',
          updatedAt: '2026-11-13T00:00:00Z',
        }),
    },
  } as unknown as Env;
  await reconcileDueHonoursIntents(env);
} finally {
  await database.end();
}
