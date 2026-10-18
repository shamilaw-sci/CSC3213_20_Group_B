import { z } from 'zod';

const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const REVISION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/+-]*$/;

export const ApiErrorCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/);

export const CorrelationIdSchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(OPAQUE_ID_PATTERN);

export const ConflictDetailsSchema = z
  .object({
    resourceType: z.string().trim().min(1).max(64),
    resourceId: z.string().trim().min(1).max(160),
    expectedRevision: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(REVISION_PATTERN)
      .optional(),
    actualRevision: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(REVISION_PATTERN)
      .optional(),
  })
  .strict();

export const ApiErrorSchema = z
  .object({
    code: ApiErrorCodeSchema,
    message: z.string().trim().min(1).max(500),
    correlationId: CorrelationIdSchema,
    conflict: ConflictDetailsSchema.optional(),
  })
  .strict();

export const ApiErrorEnvelopeSchema = z
  .object({
    version: z.literal(1),
    error: ApiErrorSchema,
  })
  .strict();

export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;
export type CorrelationId = z.infer<typeof CorrelationIdSchema>;
export type ConflictDetails = z.infer<typeof ConflictDetailsSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelopeSchema>;
