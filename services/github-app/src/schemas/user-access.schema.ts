import { z } from 'zod';

/**
 * Stored proxy settings for a single GitHub user.
 */
const proxyConfigSchema = z.object({
  active: z.boolean(),
  url: z.string(),
  availableAttempts: z.number().int().min(0).max(5),
  updatedAt: z.string().optional(),
  updatedBy: z.string().optional(),
});

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
  proxy: proxyConfigSchema,
  permissions: z.object({
    repo: z.record(z.string().min(1), repositoryPermissionSchema),
  }),
});

export const allProxyConfigSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime({ offset: true }).nullable(),
  users: z.record(
    z.string().trim().toLowerCase().email(),
    z.object({
      username: z.string().trim().min(1),
      proxy: proxyConfigSchema,
    })
  ),
});

export type UserAccessConfig = z.infer<typeof userAccessConfigSchema>;
export type AllProxyConfig = z.infer<typeof allProxyConfigSchema>;
export type RepositoryPermission = z.infer<typeof repositoryPermissionSchema>;
export type RepositoryPermissionLevel = z.infer<
  typeof repositoryPermissionLevelSchema
>;
