import 'server-only';

import {
  type Course,
  type CourseOffering,
  CourseOfferingSchema,
  CourseSchema,
  CurrentUserResponseSchema,
  type PublicAcademicPr,
  PublicAcademicPrSchema,
  type PublicCourseSchemaResponse,
  PublicCourseSchemaResponseSchema,
} from '@scs/schemas';
import { notFound } from 'next/navigation';

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
  schema: PublicCourseSchemaResponse;
  course: Course | null;
  pullRequest: PublicAcademicPr | null;
  offerings: CourseOffering[];
}

export async function loadCourseEditorData(
  courseId: string
): Promise<CourseEditorData> {
  const [user, schema, course, pullRequest, offerings] = await Promise.all([
    serverApiJson(meApiUrl(), CurrentUserResponseSchema),
    serverApiJson(
      publicCourseSchemaApiUrl(courseId),
      PublicCourseSchemaResponseSchema
    ),
    serverApiJsonOrNull(publicCourseApiUrl(courseId), CourseSchema),
    serverApiJsonOrNull(publicCoursePrApiUrl(courseId), PublicAcademicPrSchema),
    serverApiJson(publicOfferingsApiUrl(), CourseOfferingSchema.array()),
  ]);

  if (!course) notFound();

  return {
    user,
    schema,
    course,
    pullRequest,
    offerings,
  };
}

export async function loadNewCourseEditorData(): Promise<
  Pick<CourseEditorData, 'user' | 'schema' | 'offerings'>
> {
  const [user, schema, offerings] = await Promise.all([
    serverApiJson(meApiUrl(), CurrentUserResponseSchema),
    serverApiJson(
      publicCourseSchemaApiUrl('new-course'),
      PublicCourseSchemaResponseSchema
    ),
    serverApiJson(publicOfferingsApiUrl(), CourseOfferingSchema.array()),
  ]);

  return {
    user,
    schema,
    offerings,
  };
}
