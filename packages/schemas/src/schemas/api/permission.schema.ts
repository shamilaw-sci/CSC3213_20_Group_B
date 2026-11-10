import { z } from 'zod';

import { createPageSchema } from '#schemas/api/pagination.schema';

export const AppRoleSchema = z.enum([
  'USER',
  'OTHER',
  'STUDENT',
  'ACADEMIC',
  'NON_ACADEMIC',
  'ACADEMIC_SUPPORT',
]);

export const AccessLevelSchema = z.enum(['NONE', 'ADMIN', 'SUPER_ADMIN']);

export const ProfilePictureModeSchema = z.enum([
  'google',
  'github',
  'manual',
  'gravatar',
]);

/** Response from the authenticated /api/me endpoint. */
export const CurrentUserResponseSchema = z.object({
  email: z.string(),
  name: z.string().optional(),
  picture: z.string().optional(),
  role: AppRoleSchema,
  accessLevel: AccessLevelSchema,
  blacklisted: z.boolean(),
  googleOAuth: z.boolean(),
  githubOAuth: z.boolean(),
  githubUserID: z.number().nullable(),
  pictureMode: ProfilePictureModeSchema.nullable(),
  gravatarMail: z.string().nullable(),
  isEmailNotificationEnabled: z.boolean(),
  isPushNotificationEnabled: z.boolean(),
});

export const AdminUserListItemSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  picture: z.string(),
  role: AppRoleSchema,
  accessLevel: AccessLevelSchema,
  blacklisted: z.boolean(),
  createdAt: z.number().optional(),
});

export const AdminUserPageSchema = createPageSchema(AdminUserListItemSchema);

/** Detail response combines stored permission fields with auth-provider flags. */
export const AdminUserDetailResponseSchema = z.object({
  id: z.string().optional(),
  email: z.string().optional(),
  name: z.string().optional(),
  picture: z.string().optional(),
  role: AppRoleSchema,
  accessLevel: AccessLevelSchema,
  blacklisted: z.boolean().optional(),
  pictureMode: ProfilePictureModeSchema.nullable().optional(),
  gravatarMail: z.string().nullable().optional(),
  createdAt: z.number().optional(),
  include: z
    .record(z.string(), z.enum(['ADMIN', 'EDITOR', 'VIEWER']))
    .optional(),
  exclude: z.array(z.string()).optional(),
  notifications: z
    .object({ email: z.boolean().optional(), push: z.boolean().optional() })
    .optional(),
  googleOAuth: z.boolean(),
  githubOAuth: z.boolean(),
  githubUserID: z.number().nullable(),
});

export type CurrentUserResponse = z.infer<typeof CurrentUserResponseSchema>;
export type AdminUserListItem = z.infer<typeof AdminUserListItemSchema>;
export type AdminUserPage = z.infer<typeof AdminUserPageSchema>;
export type AdminUserDetailResponse = z.infer<
  typeof AdminUserDetailResponseSchema
>;

export type AppRole = z.infer<typeof AppRoleSchema>;
export type AccessLevel = z.infer<typeof AccessLevelSchema>;
export type ProfilePictureMode = z.infer<typeof ProfilePictureModeSchema>;

export const APP_ROLES = AppRoleSchema.options;
export const ACCESS_LEVELS = AccessLevelSchema.options;
export const PROFILE_PICTURE_MODES = ProfilePictureModeSchema.options;

export const APP_ROLE = {
  USER: 'USER',
  OTHER: 'OTHER',
  STUDENT: 'STUDENT',
  ACADEMIC: 'ACADEMIC',
  NON_ACADEMIC: 'NON_ACADEMIC',
  ACADEMIC_SUPPORT: 'ACADEMIC_SUPPORT',
} as const satisfies Record<AppRole, AppRole>;

export const ACCESS_LEVEL = {
  NONE: 'NONE',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const satisfies Record<AccessLevel, AccessLevel>;
