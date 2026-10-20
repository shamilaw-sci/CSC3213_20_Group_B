import { z } from 'zod';

export const repositoryPermissionLevelSchema = z.enum([
  'read',
  'triage',
  'write',
  'maintain',
  'admin',
]);

const repositoryPermissionSchema = z.object({
  permission: repositoryPermissionLevelSchema,
  updatedAt: z.string(),
  updatedBy: z.string(),
});

/** Contract for `public/config/v1/{username}.json` in the config repository. */
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
