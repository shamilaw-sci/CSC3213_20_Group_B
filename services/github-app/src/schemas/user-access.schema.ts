import { z } from 'zod';

/**
 * Repository permission levels supported by this service.
 */
export const repositoryPermissionLevelSchema = z.enum([
  'read',
  'triage',
  'write',
  'maintain',
  'admin',
]);

/**
 * Stored repository permission metadata for one repository.
 */
const repositoryPermissionSchema = z.object({
  permission: repositoryPermissionLevelSchema,
  updatedAt: z.string(),
  updatedBy: z.string(),
});

/**
 * Full per-user config stored as `public/{username}.json`.
 */
export const userAccessConfigSchema = z.object({
  permissions: z.object({
    repo: z.record(z.string().min(1), repositoryPermissionSchema),
  }),
});

export type UserAccessConfig = z.infer<typeof userAccessConfigSchema>;
export type RepositoryPermission = z.infer<typeof repositoryPermissionSchema>;
export type RepositoryPermissionLevel = z.infer<
  typeof repositoryPermissionLevelSchema
>;
