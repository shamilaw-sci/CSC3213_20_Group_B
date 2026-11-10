import { z } from 'zod';

import { createPageSchema } from '#schemas/api/pagination.schema';

export const PublicAvatarCheckIdSchema = z.enum(['safety', 'portrait']);

export const PublicAvatarCheckStatusSchema = z.enum([
  'passed',
  'failed',
  'needs_review',
  'not_checked',
]);

export const PublicAvatarCheckSchema = z.object({
  id: PublicAvatarCheckIdSchema,
  status: PublicAvatarCheckStatusSchema,
});

export const PublicAvatarModerationStatusSchema = z.enum([
  'approved',
  'rejected',
  'review_required',
  'unavailable',
]);

export const PublicAvatarModerationCodeSchema = z.enum([
  'approved',
  'unsafe_content',
  'unsuitable_portrait',
  'review_required',
  'moderation_unavailable',
  'moderation_invalid_response',
]);

export const PublicAvatarModerationSchema = z.object({
  status: PublicAvatarModerationStatusSchema,
  code: PublicAvatarModerationCodeSchema,
  message: z.string(),
  checks: z.array(PublicAvatarCheckSchema),
});

export const PublicAvatarQuotaSchema = z.object({
  limit: z.number().int().positive(),
  used: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  windowStartedAt: z.iso.datetime({ offset: true }),
  resetsAt: z.iso.datetime({ offset: true }),
  retryAfterSeconds: z.number().int().nonnegative(),
  available: z.boolean(),
});

export const PublicAvatarPendingReviewSchema = z.object({
  id: z.string(),
  sha256: z.string(),
  size: z.number().int().nonnegative(),
  submittedAt: z.iso.datetime({ offset: true }),
  moderation: PublicAvatarModerationSchema.nullable(),
});

export const PublicAvatarSchema = z.object({
  username: z.string(),
  url: z.string().nullable(),
  pending: PublicAvatarPendingReviewSchema.nullable(),
  quota: PublicAvatarQuotaSchema.optional(),
});

export const PublicAvatarUploadResultSchema = z.object({
  url: z.string(),
  sha256: z.string(),
  size: z.number().int().nonnegative(),
  updatedAt: z.iso.datetime({ offset: true }),
  moderation: PublicAvatarModerationSchema.optional(),
  quota: PublicAvatarQuotaSchema.optional(),
});

export const PublicAvatarDeleteResultSchema = z.object({
  deleted: z.boolean(),
  quota: PublicAvatarQuotaSchema.optional(),
});

export const PublicAvatarErrorSchema = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
  code: z.string().optional(),
  quota: PublicAvatarQuotaSchema.optional(),
  moderation: PublicAvatarModerationSchema.optional(),
});

export const PublicAvatarReviewStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
]);

export const PublicAvatarAuditActorKindSchema = z.enum(['owner', 'admin']);

export const PublicAvatarAuditActionSchema = z.enum([
  'upload',
  'delete',
  'admin_delete',
  'review_submitted',
  'review_approved',
  'review_rejected',
]);

export const PublicAvatarReviewSchema = z.object({
  id: z.string(),
  username: z.string(),
  sha256: z.string(),
  size: z.number().int().nonnegative(),
  status: PublicAvatarReviewStatusSchema,
  submittedAt: z.iso.datetime({ offset: true }),
  reviewedAt: z.iso.datetime({ offset: true }).nullable(),
  reviewedBy: z.string().nullable(),
  note: z.string().nullable(),
  moderation: PublicAvatarModerationSchema.nullable(),
});

export const PublicAvatarAuditEntrySchema = z.object({
  id: z.string(),
  username: z.string(),
  actorEmail: z.string(),
  actorKind: PublicAvatarAuditActorKindSchema,
  action: PublicAvatarAuditActionSchema,
  previousSha256: z.string().nullable(),
  sha256: z.string().nullable(),
  reviewId: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});

export const AdminUserAvatarSchema = z.object({
  email: z.string(),
  username: z.string(),
  url: z.string().nullable(),
  pending: z.array(PublicAvatarReviewSchema),
  history: z.array(PublicAvatarAuditEntrySchema),
  quota: PublicAvatarQuotaSchema.optional(),
});

export const AdminAvatarQuotaResetResultSchema = z.object({
  quota: PublicAvatarQuotaSchema,
});

export const AdminAvatarReviewPageSchema = createPageSchema(
  PublicAvatarReviewSchema
);

export const AdminAvatarReviewDecisionSchema = z.object({
  review: PublicAvatarReviewSchema,
  url: z.string().nullable(),
});

export const AdminAvatarDeleteResultSchema = z.object({
  deleted: z.boolean(),
});

export type PublicAvatarCheckId = z.infer<typeof PublicAvatarCheckIdSchema>;
export type PublicAvatarCheckStatus = z.infer<
  typeof PublicAvatarCheckStatusSchema
>;
export type PublicAvatarCheck = z.infer<typeof PublicAvatarCheckSchema>;
export type PublicAvatarModeration = z.infer<
  typeof PublicAvatarModerationSchema
>;
export type PublicAvatarQuota = z.infer<typeof PublicAvatarQuotaSchema>;
export type PublicAvatarPendingReview = z.infer<
  typeof PublicAvatarPendingReviewSchema
>;
export type PublicAvatar = z.infer<typeof PublicAvatarSchema>;
export type PublicAvatarUploadResult = z.infer<
  typeof PublicAvatarUploadResultSchema
>;
export type PublicAvatarDeleteResult = z.infer<
  typeof PublicAvatarDeleteResultSchema
>;
export type PublicAvatarError = z.infer<typeof PublicAvatarErrorSchema>;
export type PublicAvatarReviewStatus = z.infer<
  typeof PublicAvatarReviewStatusSchema
>;
export type PublicAvatarReview = z.infer<typeof PublicAvatarReviewSchema>;
export type PublicAvatarAuditAction = z.infer<
  typeof PublicAvatarAuditActionSchema
>;
export type PublicAvatarAuditActorKind = z.infer<
  typeof PublicAvatarAuditActorKindSchema
>;
export type PublicAvatarAuditEntry = z.infer<
  typeof PublicAvatarAuditEntrySchema
>;
export type AdminUserAvatar = z.infer<typeof AdminUserAvatarSchema>;
export type AdminAvatarReviewPage = z.infer<typeof AdminAvatarReviewPageSchema>;
export type AdminAvatarReviewDecision = z.infer<
  typeof AdminAvatarReviewDecisionSchema
>;
export type AdminAvatarDeleteResult = z.infer<
  typeof AdminAvatarDeleteResultSchema
>;
export type AdminAvatarQuotaResetResult = z.infer<
  typeof AdminAvatarQuotaResetResultSchema
>;
