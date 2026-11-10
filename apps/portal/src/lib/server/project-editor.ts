import 'server-only';

import {
  CurrentUserResponseSchema,
  ProjectSchema,
  type PublicProjectSchemaResponse,
  PublicProjectSchemaResponseSchema,
} from '@scs/schemas';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import {
  meApiUrl,
  publicCoursesApiUrl,
  publicOfferingsApiUrl,
  publicProjectApiUrl,
  publicProjectSchemaApiUrl,
} from '@/lib/api';
import { serverApiJson, serverApiJsonOrNull } from '@/lib/server/api-client';

interface ProjectEditorUser {
  email: string;
  name?: string;
  role?: string;
  accessLevel?: unknown;
}

export interface ProjectEditorData {
  user: ProjectEditorUser;
  schema: PublicProjectSchemaResponse;
  project: Record<string, unknown> | null;
  courses: unknown[];
  offerings: unknown[];
}

export async function loadProjectEditorData(
  slug: string
): Promise<ProjectEditorData> {
  const [user, schema, project, courses, offerings] = await Promise.all([
    serverApiJson(meApiUrl(), CurrentUserResponseSchema),
    serverApiJson(
      publicProjectSchemaApiUrl(slug),
      PublicProjectSchemaResponseSchema
    ),
    serverApiJsonOrNull(publicProjectApiUrl(slug), ProjectSchema),
    serverApiJson(publicCoursesApiUrl(), z.array(z.unknown())),
    serverApiJson(publicOfferingsApiUrl(), z.array(z.unknown())),
  ]);

  if (!project) notFound();

  return { user, schema, project, courses, offerings };
}
