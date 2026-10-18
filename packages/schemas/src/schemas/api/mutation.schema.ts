import { z } from 'zod';

import { OperationIdSchema } from '#schemas/api/operation.schema';

const OPAQUE_TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/+-]*$/;

export const IdempotencyKeySchema = z
  .string()
  .trim()
  .min(16)
  .max(128)
  .regex(OPAQUE_TOKEN_PATTERN);

export const EntityRevisionSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(OPAQUE_TOKEN_PATTERN);

export const MutationControlSchema = z
  .object({
    idempotencyKey: IdempotencyKeySchema,
    expectedRevision: EntityRevisionSchema.optional(),
  })
  .strict();

export const MutationAcceptedSchema = z
  .object({
    version: z.literal(1),
    operationId: OperationIdSchema,
    status: z.enum(['queued', 'running']),
    statusUrl: z
      .string()
      .trim()
      .regex(/^\/api\/operations\/[A-Za-z0-9][A-Za-z0-9._:-]*$/),
    retryAfterMs: z.number().int().min(250).max(30_000),
  })
  .strict();

export type IdempotencyKey = z.infer<typeof IdempotencyKeySchema>;
export type EntityRevision = z.infer<typeof EntityRevisionSchema>;
export type MutationControl = z.infer<typeof MutationControlSchema>;
export type MutationAccepted = z.infer<typeof MutationAcceptedSchema>;
