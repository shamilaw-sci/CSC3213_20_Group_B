import { z } from 'zod';

import { ApiErrorSchema } from '#schemas/api/error.schema';

const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const REVISION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/+-]*$/;

export const OperationIdSchema = z
  .string()
  .trim()
  .min(16)
  .max(128)
  .regex(OPAQUE_ID_PATTERN);

export const OperationResourceTypeSchema = z.enum([
  'profile',
  'project',
  'course',
  'offering',
  'config',
  'user_access',
  'student_placement',
]);

export const OperationResourceSchema = z
  .object({
    type: OperationResourceTypeSchema,
    id: z.string().trim().min(1).max(160),
  })
  .strict();

export const OperationActorSchema = z
  .object({
    type: z.enum(['user', 'service']),
    subjectId: z.string().trim().min(16).max(128).regex(OPAQUE_ID_PATTERN),
  })
  .strict();

export const OperationStatusSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'failed',
  'conflicted',
  'cancelled',
]);

const PullRequestReferenceSchema = z
  .object({
    number: z.number().int().positive(),
    url: z.url(),
  })
  .strict();

const RevisionSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(REVISION_PATTERN);

const SucceededOperationOutcomeSchema = z
  .object({
    status: z.literal('succeeded'),
    revision: RevisionSchema.optional(),
    pullRequest: PullRequestReferenceSchema.optional(),
  })
  .strict();

const FailedOperationOutcomeSchema = z
  .object({
    status: z.literal('failed'),
    error: ApiErrorSchema,
  })
  .strict();

const ConflictedOperationOutcomeSchema = z
  .object({
    status: z.literal('conflicted'),
    error: ApiErrorSchema,
  })
  .strict();

const CancelledOperationOutcomeSchema = z
  .object({
    status: z.literal('cancelled'),
    error: ApiErrorSchema,
  })
  .strict();

export const OperationOutcomeSchema = z.discriminatedUnion('status', [
  SucceededOperationOutcomeSchema,
  FailedOperationOutcomeSchema,
  ConflictedOperationOutcomeSchema,
  CancelledOperationOutcomeSchema,
]);

const OperationResponseBaseSchema = z.object({
  version: z.literal(1),
  operationId: OperationIdSchema,
  resource: OperationResourceSchema,
  actor: OperationActorSchema,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export const OperationStatusResponseSchema = z.discriminatedUnion('status', [
  OperationResponseBaseSchema.extend({
    status: z.literal('queued'),
  }).strict(),
  OperationResponseBaseSchema.extend({
    status: z.literal('running'),
    startedAt: z.iso.datetime({ offset: true }),
  }).strict(),
  OperationResponseBaseSchema.extend({
    status: z.literal('succeeded'),
    completedAt: z.iso.datetime({ offset: true }),
    outcome: SucceededOperationOutcomeSchema,
  }).strict(),
  OperationResponseBaseSchema.extend({
    status: z.literal('failed'),
    completedAt: z.iso.datetime({ offset: true }),
    outcome: FailedOperationOutcomeSchema,
  }).strict(),
  OperationResponseBaseSchema.extend({
    status: z.literal('conflicted'),
    completedAt: z.iso.datetime({ offset: true }),
    outcome: ConflictedOperationOutcomeSchema,
  }).strict(),
  OperationResponseBaseSchema.extend({
    status: z.literal('cancelled'),
    completedAt: z.iso.datetime({ offset: true }),
    outcome: CancelledOperationOutcomeSchema,
  }).strict(),
]);

export type OperationId = z.infer<typeof OperationIdSchema>;
export type OperationResourceType = z.infer<typeof OperationResourceTypeSchema>;
export type OperationResource = z.infer<typeof OperationResourceSchema>;
export type OperationActor = z.infer<typeof OperationActorSchema>;
export type OperationStatus = z.infer<typeof OperationStatusSchema>;
export type OperationOutcome = z.infer<typeof OperationOutcomeSchema>;
export type OperationStatusResponse = z.infer<
  typeof OperationStatusResponseSchema
>;
