import { z } from 'zod';

import { HonoursProgrammeCodeSchema } from '#schemas/academics/academic-organization.schema';
import { CorrelationIdSchema } from '#schemas/api/error.schema';
import {
  IdempotencyKeySchema,
  MutationAcceptedSchema,
} from '#schemas/api/mutation.schema';
import {
  OperationActorSchema,
  OperationIdSchema,
} from '#schemas/api/operation.schema';
import { StudentTrackSchema } from '#schemas/people/students/student.schema';

export const HonoursPreviewRequestSchema = z
  .object({
    batch: z.string().regex(/^s\d{2}$/i),
    programme: HonoursProgrammeCodeSchema,
    include: z.string().max(4000),
    exclude: z.string().max(4000).default(''),
    additional: z.string().max(4000).default(''),
    operation: z.enum(['assign', 'change', 'revoke']),
  })
  .strict();

export const HonoursPreviewOutcomeSchema = z.enum([
  'missing_account',
  'no_public_profile',
  'ineligible',
  'planned_assign',
  'planned_revoke',
  'unchanged',
  'matching',
  'conflict',
]);

export const HonoursPreviewEntrySchema = z.object({
  identifier: z.string(),
  outcome: HonoursPreviewOutcomeSchema,
  oldTrack: StudentTrackSchema.nullable(),
  oldProgramme: HonoursProgrammeCodeSchema.nullable(),
  newTrack: StudentTrackSchema.nullable(),
  newProgramme: HonoursProgrammeCodeSchema.nullable(),
});

export const HonoursPreviewResponseSchema = z.object({
  batch: z.string(),
  programme: HonoursProgrammeCodeSchema,
  operation: HonoursPreviewRequestSchema.shape.operation,
  total: z.number().int().nonnegative(),
  excluded: z.array(z.string()),
  counts: z.record(z.string(), z.number().int().nonnegative()),
  entries: z.array(HonoursPreviewEntrySchema).max(1000),
});

export const HonoursBulkApplyRequestSchema = HonoursPreviewRequestSchema.extend(
  {
    reason: z.string().trim().min(10).max(500),
    idempotencyKey: IdempotencyKeySchema,
    expectedEntries: z.array(HonoursPreviewEntrySchema).min(1).max(500),
    overwriteConflicts: z.boolean(),
    confirmation: z.literal(true),
  }
).strict();

export const HonoursBulkChangeSchema = z
  .object({
    identifier: z.string().regex(/^S\d{2}(?:SP)?\d{3}$/),
    oldTrack: StudentTrackSchema.nullable(),
    oldProgramme: HonoursProgrammeCodeSchema.nullable(),
    newTrack: StudentTrackSchema,
    newProgramme: HonoursProgrammeCodeSchema.nullable(),
  })
  .strict();

export const HonoursBulkOperationRequestSchema = z
  .object({
    batch: z.string().regex(/^s\d{2}$/),
    programme: HonoursProgrammeCodeSchema,
    operation: HonoursPreviewRequestSchema.shape.operation,
    reason: z.string().trim().min(10).max(500),
    updatedBy: z.email(),
    changes: z.array(HonoursBulkChangeSchema).min(1).max(250),
  })
  .strict()
  .superRefine((value, context) => {
    const seen = new Set<string>();
    for (const [index, change] of value.changes.entries()) {
      if (
        seen.has(change.identifier) ||
        !change.identifier.toLowerCase().startsWith(value.batch)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['changes', index, 'identifier'],
          message: 'Duplicate or wrong-batch identifier',
        });
      }
      seen.add(change.identifier);
      const expectedTrack =
        value.operation === 'revoke' ? 'GENERAL' : 'HONOURS';
      const expectedProgramme =
        value.operation === 'revoke' ? null : value.programme;
      if (
        change.newTrack !== expectedTrack ||
        change.newProgramme !== expectedProgramme
      ) {
        context.addIssue({
          code: 'custom',
          path: ['changes', index],
          message: 'Change does not match the operation',
        });
      }
    }
  });

export const SubmitHonoursBulkOperationSchema = z
  .object({
    request: HonoursBulkOperationRequestSchema,
    actorSubjectId: OperationActorSchema.shape.subjectId,
    idempotencyKey: IdempotencyKeySchema,
    correlationId: CorrelationIdSchema,
  })
  .strict();

export const HonoursBulkAcceptedSchema = MutationAcceptedSchema;

export const HonoursHistoryStatusSchema = z.enum([
  'pending_acceptance',
  'accepted',
  'processing',
  'awaiting_publication',
  'published',
  'failed',
]);

export const HonoursApplyResponseSchema = z.object({
  version: z.literal(1),
  operationId: OperationIdSchema,
  status: HonoursHistoryStatusSchema,
  statusUrl: z.string().regex(/^\/api\/operations\/op_[a-f0-9]{64}$/),
  plannedChanges: z.number().int().min(1).max(250),
});

export const HonoursOperationHistoryEntrySchema = z.object({
  operationId: OperationIdSchema,
  actorEmail: z.email(),
  batch: z.string().regex(/^s\d{2}$/),
  programme: HonoursProgrammeCodeSchema,
  operation: HonoursPreviewRequestSchema.shape.operation,
  reason: z.string(),
  changes: z.array(HonoursBulkChangeSchema).max(250),
  createdAt: z.number().int().nonnegative(),
  status: HonoursHistoryStatusSchema.default('accepted'),
  failureReason: z.string().nullable().default(null),
});

export const HonoursOperationHistoryResponseSchema = z.object({
  items: z.array(HonoursOperationHistoryEntrySchema).max(20),
  nextCursor: z.string().nullable(),
});

export type HonoursPreviewRequest = z.infer<typeof HonoursPreviewRequestSchema>;
export type HonoursPreviewResponse = z.infer<
  typeof HonoursPreviewResponseSchema
>;
export type HonoursBulkChange = z.infer<typeof HonoursBulkChangeSchema>;
export type HonoursBulkOperationRequest = z.infer<
  typeof HonoursBulkOperationRequestSchema
>;
export type HonoursOperationHistoryEntry = z.infer<
  typeof HonoursOperationHistoryEntrySchema
>;
export type HonoursHistoryStatus = z.infer<typeof HonoursHistoryStatusSchema>;
