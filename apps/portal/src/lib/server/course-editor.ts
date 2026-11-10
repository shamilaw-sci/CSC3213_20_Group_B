import 'server-only';

import {
  type Course,
  type CourseOffering,
  CourseOfferingSchema,
  CourseSchema,
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
    serverApiJson<Record<string, unknown>>(meApiUrl()),
    serverApiJson<unknown>(publicCourseSchemaApiUrl(courseId)),
    serverApiJsonOrNull<unknown>(publicCourseApiUrl(courseId)),
    serverApiJsonOrNull<unknown>(publicCoursePrApiUrl(courseId)),
    serverApiJson<unknown>(publicOfferingsApiUrl()),
  ]);

  if (!course) notFound();

  return {
    user,
    schema: PublicCourseSchemaResponseSchema.parse(schema),
    course: CourseSchema.parse(course),
    pullRequest:
      pullRequest === null ? null : PublicAcademicPrSchema.parse(pullRequest),
    offerings: CourseOfferingSchema.array().parse(offerings),
  };
}

export async function loadNewCourseEditorData(): Promise<
  Pick<CourseEditorData, 'user' | 'schema' | 'offerings'>
> {
  const [user, schema, offerings] = await Promise.all([
    serverApiJson<Record<string, unknown>>(meApiUrl()),
    serverApiJson<unknown>(publicCourseSchemaApiUrl('new-course')),
    serverApiJson<unknown>(publicOfferingsApiUrl()),
  ]);

  return {
    user,
    schema: PublicCourseSchemaResponseSchema.parse(schema),
    offerings: CourseOfferingSchema.array().parse(offerings),
  };
}
