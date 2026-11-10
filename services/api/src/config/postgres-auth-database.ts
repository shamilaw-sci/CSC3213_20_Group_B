import { Pool, types } from 'pg';
import { z } from 'zod';

const PostgresAuthDatabaseConfigSchema = z.object({
  connectionString: z.url().refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === 'postgres:' || protocol === 'postgresql:';
  }, 'Expected a PostgreSQL connection URL'),
  maxConnections: z.int().min(1).max(50).default(10),
  schema: z
    .string()
    .regex(/^[a-z][a-z0-9_]*$/)
    .optional(),
});

/** Import only from a Bun/Node composition root, never from the Worker entry. */
export function createPostgresAuthDatabase(input: unknown): Pool {
  const config = PostgresAuthDatabaseConfigSchema.parse(input);
  return new Pool({
    connectionString: config.connectionString,
    max: config.maxConnections,
    ...(config.schema ? { options: `-c search_path=${config.schema}` } : {}),
    types: {
      getTypeParser(oid, format) {
        if (oid === types.builtins.INT8 && format === 'text') {
          return (value: string) => {
            const parsed = Number(value);
            if (!Number.isSafeInteger(parsed))
              throw new Error(
                'PostgreSQL BIGINT exceeds JavaScript safe integer range'
              );
            return parsed;
          };
        }
        return types.getTypeParser(oid, format) as (value: string) => unknown;
      },
    },
  });
}
