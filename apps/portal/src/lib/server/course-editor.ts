import 'server-only';

import {
  meApiUrl,
  publicCourseApiUrl,
  publicCoursePrApiUrl,
  publicCourseSchemaApiUrl,
  publicOfferingsApiUrl,
} from '@/lib/api';
import { serverApiJson, serverApiJsonOrNull } from '@/lib/server/api-client';

export interface CourseEditorData {
  user: Record<string, unknown>;
  schema: {
    canEditCourses: boolean;
    identity: { email: string; username: string };
    lockedFields: string[];
    note: string;
  };
  course: Record<string, unknown> | null;
  pullRequest: Record<string, unknown> | null;
  offerings: unknown[];
}

export async function loadCourseEditorData(
  courseId: string
): Promise<CourseEditorData> {
  const [user, schema, course, pullRequest, offerings] = await Promise.all([
    serverApiJson<Record<string, unknown>>(meApiUrl()),
    serverApiJson<CourseEditorData['schema']>(
      publicCourseSchemaApiUrl(courseId)
    ),
    serverApiJsonOrNull<Record<string, unknown>>(publicCourseApiUrl(courseId)),
    serverApiJsonOrNull<Record<string, unknown>>(
      publicCoursePrApiUrl(courseId)
    ),
    serverApiJson<unknown[]>(publicOfferingsApiUrl()),
  ]);

  return { user, schema, course, pullRequest, offerings };
}

export async function loadNewCourseEditorData(): Promise<
  Pick<CourseEditorData, 'user' | 'schema' | 'offerings'>
> {
  const [user, schema, offerings] = await Promise.all([
    serverApiJson<Record<string, unknown>>(meApiUrl()),
    serverApiJson<CourseEditorData['schema']>(
      publicCourseSchemaApiUrl('new-course')
    ),
    serverApiJson<unknown[]>(publicOfferingsApiUrl()),
  ]);

  return { user, schema, offerings };
}
