import { z } from 'zod';

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

export const PublicAvatarSchema = z.object({
  username: z.string(),
  url: z.string().nullable(),
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

export type PublicAvatarCheckId = z.infer<typeof PublicAvatarCheckIdSchema>;
export type PublicAvatarCheckStatus = z.infer<
  typeof PublicAvatarCheckStatusSchema
>;
export type PublicAvatarCheck = z.infer<typeof PublicAvatarCheckSchema>;
export type PublicAvatarModeration = z.infer<
  typeof PublicAvatarModerationSchema
>;
export type PublicAvatarQuota = z.infer<typeof PublicAvatarQuotaSchema>;
export type PublicAvatar = z.infer<typeof PublicAvatarSchema>;
export type PublicAvatarUploadResult = z.infer<
  typeof PublicAvatarUploadResultSchema
>;
export type PublicAvatarDeleteResult = z.infer<
  typeof PublicAvatarDeleteResultSchema
>;
export type PublicAvatarError = z.infer<typeof PublicAvatarErrorSchema>;
