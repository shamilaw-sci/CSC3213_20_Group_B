import 'server-only';

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

interface ProjectEditorSchema {
  canSubmitOwnedProjects: boolean;
  canSubmitAnyProject: boolean;
  identity: {
    email: string;
    username: string;
    sNumber: string | null;
  };
  lockedFields: string[];
  note: string;
}

export interface ProjectEditorData {
  user: ProjectEditorUser;
  schema: ProjectEditorSchema;
  project: Record<string, unknown> | null;
  courses: unknown[];
  offerings: unknown[];
}

export async function loadProjectEditorData(
  slug: string
): Promise<ProjectEditorData> {
  const [user, schema, project, courses, offerings] = await Promise.all([
    serverApiJson<ProjectEditorUser>(meApiUrl()),
    serverApiJson<ProjectEditorSchema>(publicProjectSchemaApiUrl(slug)),
    serverApiJsonOrNull<Record<string, unknown>>(publicProjectApiUrl(slug)),
    serverApiJson<unknown[]>(publicCoursesApiUrl()),
    serverApiJson<unknown[]>(publicOfferingsApiUrl()),
  ]);

  return { user, schema, project, courses, offerings };
}
