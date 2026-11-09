import { z } from 'zod';

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
