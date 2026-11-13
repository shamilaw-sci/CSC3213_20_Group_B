import { z } from 'zod';

import { AppRoleSchema } from '#schemas/api/permission.schema';

export const IdentityReviewStatusSchema = z.enum([
  'PENDING',
  'NEEDS_EVIDENCE',
  'APPROVED',
  'RETAINED_OTHER',
  'CONFLICT',
  'NOT_REQUIRED',
]);
const IdentityDecisionStatusSchema = IdentityReviewStatusSchema.exclude([
  'NOT_REQUIRED',
]);
export const IdentityDecisionSourceSchema = z.enum(['MANUAL', 'REVIEW']);
export const IdentityClassificationSourceSchema = z.enum([
  'STUDENT_PATTERN',
  'AUTOMATIC',
  'EXISTING',
  'MANUAL',
  'REVIEW',
  'MIGRATION',
]);

export const IdentityAccountsQuerySchema = z
  .object({
    query: z.string().trim().max(100).default(''),
    cursor: z.email().max(255).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(25),
    role: AppRoleSchema.optional(),
    status: IdentityReviewStatusSchema.optional(),
    verified: z.enum(['all', 'verified', 'unverified']).default('all'),
  })
  .strict();

export const IdentityDecisionRequestSchema = z
  .object({
    email: z.email(),
    expectedRole: AppRoleSchema,
    role: AppRoleSchema,
    status: IdentityDecisionStatusSchema,
    source: IdentityDecisionSourceSchema,
    note: z.string().trim().max(1000),
  })
  .strict();

export const IdentityAccountSchema = z.object({
  email: z.email(),
  name: z.string(),
  role: AppRoleSchema,
  accessLevel: z.enum(['NONE', 'ADMIN', 'SUPER_ADMIN']),
  createdAt: z.number().nullable(),
  emailVerified: z.boolean(),
  status: IdentityReviewStatusSchema,
  source: IdentityClassificationSourceSchema,
  reviewedBy: z.string().nullable(),
  reviewedAt: z.number().nullable(),
  note: z.string(),
});

export const IdentityAccountsResponseSchema = z.object({
  items: z.array(IdentityAccountSchema).max(50),
  nextCursor: z.string().nullable(),
});

export const IdentityAuditSchema = z.object({
  id: z.string(),
  email: z.email(),
  oldRole: AppRoleSchema,
  newRole: AppRoleSchema,
  status: IdentityReviewStatusSchema,
  source: IdentityClassificationSourceSchema,
  note: z.string(),
  reviewedBy: z.string(),
  reviewedAt: z.number(),
});

export const IdentityHistoryResponseSchema = z.object({
  items: z.array(IdentityAuditSchema).max(50),
});

export const IdentitySuggestionResponseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('suggested'),
    role: AppRoleSchema,
    confidence: z.number().min(0).max(1),
    evidenceSummary: z.string(),
  }),
  z.object({
    kind: z.enum([
      'insufficient_evidence',
      'conflicting_evidence',
      'unsupported_classification',
    ]),
    evidenceSummary: z.string(),
  }),
  z.object({ kind: z.literal('unavailable') }),
]);

export type IdentityReviewStatus = z.infer<typeof IdentityReviewStatusSchema>;
export type IdentityDecisionSource = z.infer<
  typeof IdentityDecisionSourceSchema
>;
export type IdentityAccount = z.infer<typeof IdentityAccountSchema>;
export type IdentityAudit = z.infer<typeof IdentityAuditSchema>;
